# 改用 bill.unclereal.com 同源部署,取代 ADR-0003

**Status**: accepted

ADR-0003 選了前後端分離子網域 + CORS,原因是當時使用者沒有自訂網域可用。實際部署時發現使用者已經擁有 `unclereal.com` 且已經掛在這個 Cloudflare 帳號底下(zone 狀態 active,nameservers 已指向 Cloudflare),同時使用者在意 `*.workers.dev` 的帳號級 subdomain(例如 `bill-backend.manmea45.workers.dev`)會暴露 Cloudflare 帳號 email 這件事。兩個因素都指向改回 ADR-0003 原本列為備案的「同一網域 + Worker Route」架構。

改動:`bill.unclereal.com` 作為 Pages 自訂網域,後端 Worker 的 `wrangler.jsonc` 加一條 route `bill.unclereal.com/api/*` 轉給 Worker,其餘路徑落到 Pages。前端拿掉 `API_BASE`/`VITE_API_BASE_URL` 機制,全部改回寫死的相對路徑 `/api/...`(本機 Vite proxy、production 同源,兩邊都成立,不用再分 build-time 變數)。後端拿掉 CORS middleware 跟 `FRONTEND_ORIGIN` 變數。Cloudflare Access 只需要保護一個網域(`bill.unclereal.com`),不用兩個。

代價:多了一個「先幫 Pages 掛自訂網域、產生 DNS 記錄,再部署帶 route 的 Worker」的先後順序限制(Worker route 要吃到 Cloudflare 代理的 DNS 記錄才會生效)。這筆帳記在 docs/deployment.md 裡。
