# 部署流程

v1 走手動 `wrangler` 部署,不設 CI/CD(見原始工單範圍)。架構是前後端同源部署在 `bill.unclereal.com`,Worker Route 把 `/api/*` 轉給後端、其餘路徑落到 Pages,見 [ADR-0004](./adr/0004-same-origin-custom-domain.md)(取代了原本打算用免費 `*.pages.dev`/`*.workers.dev` 子網域的 [ADR-0003](./adr/0003-separate-subdomains-with-cors.md))。

這份文件記的是**實際跑過一次**部署後的真實步驟,包含中途踩到的幾個雷。

## 前置準備

- Cloudflare 帳號,`npx wrangler login` 登入過(互動式 OAuth,需要在真人瀏覽器裡按允許)
- 一個已經加到這個 Cloudflare 帳號、且 zone 狀態是 active 的自訂網域(這裡用 `unclereal.com`,app 掛在 `bill.unclereal.com`)
- `backend/wrangler.jsonc` 裡的 `database_id`、`ACCESS_TEAM_DOMAIN`、`ACCESS_AUD` 目前是佔位字串,照下面步驟填入

## 1. 後端:建立 D1 資料庫

```sh
cd backend
npx wrangler d1 create bill-db
```

把輸出的 `database_id` 貼進 `backend/wrangler.jsonc` 的 `d1_databases[0].database_id`。

套用 schema 到這個正式資料庫:

```sh
npm run db:migrate:remote
```

## 2. 前端:建立 Pages 專案並部署

`wrangler pages deploy`/`wrangler pages project create` 預設會嘗試把專案「升級」成新的 Pages-as-Workers 架構,過程中會想幫你改 `package.json`、建立 `wrangler.jsonc`、裝額外套件——這個升級流程在這個環境因為 npm 的 `allowScripts` 限制會直接失敗。**一定要加 `--force`** 走原本的 Pages 部署方式,不要讓它嘗試升級:

```sh
cd ../frontend
npm run build
npx wrangler pages project create bill-frontend --production-branch=main --force
npx wrangler pages deploy dist --project-name=bill-frontend
```

`project create` 只有第一次需要 `--force`;後續的 `pages deploy` 一旦專案已存在,就會直接打 Pages API,不會再觸發升級流程。

這步會給一個 `https://bill-frontend.pages.dev` 網址,可以先用它確認部署有成功,但正式網址是下一步設定的自訂網域。

## 3. 前端:掛自訂網域

`wrangler` 沒有對應的 CLI 指令可以幫 Pages 專案加自訂網域,要用 API:

```sh
curl -X POST "https://api.cloudflare.com/client/v4/accounts/<account_id>/pages/projects/bill-frontend/domains" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"bill.unclereal.com"}'
```

這一步只會在 Cloudflare 那邊登記這個網域「打算」指到這個 Pages 專案,**不會自動建立 DNS 記錄**(即使網域跟 Pages 專案在同一個帳號下)。要自己在 dashboard 的 DNS 設定加一筆:

- Type: `CNAME`
- Name: `bill`
- Target: `bill-frontend.pages.dev`
- Proxy status: **Proxied**(橘色雲朵,一定要開,不然後面的 Worker Route 跟 Access 都不會生效)

加完後 Cloudflare 會自動驗證 CNAME、簽發憑證,通常一兩分鐘內用這個指令可以看到狀態變成 `active`:

```sh
curl -s "https://api.cloudflare.com/client/v4/accounts/<account_id>/pages/projects/bill-frontend/domains/bill.unclereal.com" \
  -H "Authorization: Bearer <token>"
```

## 4. 後端:設定 Worker Route 並部署

`backend/wrangler.jsonc` 已經設好:

```jsonc
"routes": [
  { "pattern": "bill.unclereal.com/api/*", "zone_name": "unclereal.com" }
]
```

`zone_name` 要跟你實際的網域一致。前提是上一步的 DNS 記錄已經生效(Worker Route 要吃到 Cloudflare 代理的流量才會攔截),所以要先完成步驟 3 再部署後端:

```sh
cd ../backend
npm run deploy
```

部署時 wrangler 會提示 `workers_dev` 因為設了 `routes`而預設關閉——這是故意的,不會再有 `bill-backend.<account>.workers.dev` 這個會暴露帳號身份的網址。

驗證路由正確分流:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://bill.unclereal.com/api/accounts   # 打到 Worker
curl -s -o /dev/null -w "%{http_code}\n" https://bill.unclereal.com/               # 落到 Pages
```

## 5. 設定 Cloudflare Access

`wrangler login` 拿到的 OAuth token 權限不包含 DNS 寫入、也不包含 Zero Trust/Access,這塊只能在 dashboard 操作,沒有對應 CLI。

1. 前往 [Zero Trust dashboard](https://one.dash.cloudflare.com)。第一次使用要先取一個團隊名稱(變成 `<team-name>.cloudflareaccess.com`)。
2. **Access → Applications → Add an application → Self-hosted**
   - Application domain:`bill.unclereal.com`(整個網域一起保護,`/api/*` 也涵蓋在內,不用另外設)
   - 加一條 policy:Action `Allow`,Include 選 `Emails`,填你自己的 email
   - Policy 的名稱本身不影響行為,純粹給自己看的標籤
3. 建立完成後,要拿到 **AUD tag**——介面上不一定好找(不同版本位置不同),最快的方式是用一個有 `Zero Trust: Read` 權限的 API token 查:

```sh
curl -s "https://api.cloudflare.com/client/v4/accounts/<account_id>/access/apps" \
  -H "Authorization: Bearer <token>" | python3 -m json.tool
```

回傳的每個 application 都有 `aud` 欄位。團隊網域則是:

```sh
curl -s "https://api.cloudflare.com/client/v4/accounts/<account_id>/access/organizations" \
  -H "Authorization: Bearer <token>"
```

回傳的 `auth_domain` 就是 `ACCESS_TEAM_DOMAIN`。

4. 編輯 `backend/wrangler.jsonc`:
   - `vars.ACCESS_TEAM_DOMAIN` 改成上面查到的 `auth_domain`
   - `vars.ACCESS_AUD` 改成上面查到的 `aud`
5. 重新部署讓新設定生效:

```sh
cd backend
npm run deploy
```

## 6. 驗證

打開 `https://bill.unclereal.com`,應該被導去 Access 登入頁;用 policy 允許的 email 登入後,能看到 app 畫面,且前端打後端 API 沒有錯誤(因為同源,不會有 CORS 問題)。沒登入時直接打 API(`curl https://bill.unclereal.com/api/accounts`)應該被 Access 擋下、回 302 到登入頁,而不是看到真正的資料。

## 之後要改 code 重新部署

不涉及 schema 變動、不涉及 route/Access 設定時,各自重新 build/deploy 就好:

```sh
# 後端
cd backend && npm run deploy

# 前端
cd frontend && npm run build && npx wrangler pages deploy dist --project-name=bill-frontend
```

## 本機開發

跟正式環境不同,本機不需要 Access、不需要自訂網域:

```sh
# 後端
cd backend
cp .dev.vars.example .dev.vars   # DEV_MODE=true 會跳過 Access JWT 驗證
npm run dev                       # 預設跑在 :8787

# 前端(另開一個 terminal)
cd frontend
npm run dev                       # 跑在 :5173,vite.config.ts 會把 /api 轉給 :8787
```
