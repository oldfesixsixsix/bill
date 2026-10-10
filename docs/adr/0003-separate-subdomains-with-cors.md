# 前後端部署在各自的 *.pages.dev / *.workers.dev 子網域,用 CORS 串接

**Status**: superseded by [ADR-0004](./0004-same-origin-custom-domain.md)

部署架構可以選「同一個自訂網域 + Worker Route 把 /api/* 轉給 Workers」(同源,不需要 CORS,Access 只要保護一個網域),也可以選「Pages 跟 Workers 各自用 Cloudflare 免費的 *.pages.dev / *.workers.dev 子網域,前端用絕對 URL 呼叫後端」。選擇後者,因為使用者目前沒有要接到自訂網域,免費子網域可以直接動工。代價是前端的 API base URL 必須在 build time 透過 `VITE_API_BASE_URL` 指定(`frontend/src/api/base.ts`),不能再用寫死的相對路徑;後端需要 CORS middleware(`credentials: true` + 明確 origin,見 `backend/src/index.ts`);Cloudflare Access 需要分別保護兩個網域,而不是一個。日後若接自訂網域,可以改回同源架構、拿掉 CORS,但前端的 API_BASE 機制不用動(把它設回空字串/相對路徑即可)。
