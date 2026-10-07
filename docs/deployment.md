# 部署流程

v1 走手動 `wrangler` 部署,不設 CI/CD(見原始工單範圍)。架構是前後端各自獨立的 Cloudflare 子網域 + CORS,見 [ADR-0003](./adr/0003-separate-subdomains-with-cors.md)。

因為後端需要知道前端的網域(CORS)、前端需要知道後端的網域(API base URL),兩邊互相依賴,第一次部署要照下面順序走,之後要改 code 重新部署就不用管順序了。

## 前置準備

- Cloudflare 帳號,`npx wrangler login` 登入過
- `backend/wrangler.jsonc` 跟 `frontend/.env.production.example` 目前的網域、ID 都是佔位字串,照下面步驟一一填入

## 1. 後端:建立 D1 資料庫

```sh
cd backend
npx wrangler d1 create bill-db
```

把輸出的 `database_id` 貼進 `backend/wrangler.jsonc` 的 `d1_databases[0].database_id`(取代 `local-only-placeholder-fill-in-after-wrangler-d1-create`)。

套用 schema 到這個正式資料庫:

```sh
npm run db:migrate:remote
```

## 2. 後端:第一次部署(先不管 CORS/Access 的值)

```sh
npm run deploy
```

輸出會給一個 `https://bill-backend.<你的 subdomain>.workers.dev` 網址,記下來,下一步要用。

## 3. 前端:設定 API base URL 並部署

```sh
cd ../frontend
cp .env.production.example .env.production.local
```

編輯 `.env.production.local`,把 `VITE_API_BASE_URL` 改成上一步拿到的後端網址。

```sh
npm run build
npx wrangler pages deploy dist --project-name=bill-frontend
```

第一次執行會建立 Pages 專案。輸出會給一個 `https://bill-frontend.pages.dev`(或類似)網址,記下來。

## 4. 後端:補上 FRONTEND_ORIGIN,重新部署

編輯 `backend/wrangler.jsonc`,把 `vars.FRONTEND_ORIGIN` 改成上一步拿到的 Pages 網址,然後:

```sh
cd ../backend
npm run deploy
```

這步只是讓 CORS 放行前端網域,不涉及 schema,很快。

## 5. 設定 Cloudflare Access

這是個人使用的工具,前後端都要擋在 Access 後面,只允許自己的 email 登入。

1. 在 Cloudflare dashboard 的 Zero Trust 區塊,確認有設定過團隊網域(team domain,形如 `<team-name>.cloudflareaccess.com`)。
2. 建立兩個 Self-hosted Access application:
   - 一個保護 `bill-frontend.pages.dev`(或你的實際網址)
   - 一個保護 `bill-backend.<subdomain>.workers.dev`
   - 每個都加一條 policy,只允許你自己的 email 登入
   - Cloudflare 的 Access UI 原則上可以直接選 `*.pages.dev`/`*.workers.dev` 當保護目標;如果介面上找不到這個選項,代表你的帳號版本需要掛一個自訂網域才能用 Access,那就是 ADR-0003 裡提到、這次沒選的另一個部署架構,需要回頭調整。
3. 在 Workers 那個 application 的 Overview 頁面會顯示一個 **AUD tag**,複製下來。
4. 編輯 `backend/wrangler.jsonc`:
   - `vars.ACCESS_TEAM_DOMAIN` 改成 `<team-name>.cloudflareaccess.com`
   - `vars.ACCESS_AUD` 改成上一步的 AUD tag
5. 重新部署後端讓新設定生效:

```sh
cd backend
npm run deploy
```

## 6. 驗證

打開前端網址,應該先被導去 Access 登入頁,登入後才看得到 app;app 打後端 API 應該正常回應(打開瀏覽器 devtools 的 Network 分頁確認沒有 CORS 錯誤、沒有 401)。

## 之後要改 code 重新部署

不涉及 schema 變動時,各自重新 build/deploy 就好,不用重做上面的設定步驟:

```sh
# 後端
cd backend && npm run deploy

# 前端
cd frontend && npm run build && npx wrangler pages deploy dist --project-name=bill-frontend
```

## 本機開發

跟正式環境不同,本機不需要 Access、不需要 CORS、不需要設定 `VITE_API_BASE_URL`:

```sh
# 後端
cd backend
cp .dev.vars.example .dev.vars   # DEV_MODE=true 會跳過 Access JWT 驗證
npm run dev                       # 預設跑在 :8787

# 前端(另開一個 terminal)
cd frontend
npm run dev                       # 跑在 :5173,vite.config.ts 會把 /api 轉給 :8787
```
