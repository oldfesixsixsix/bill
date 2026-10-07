# Workers API 驗證 Cloudflare Access JWT 簽章,不信任 header

**Status**: accepted

身份驗證可以簡化成直接信任 Access 注入的 `Cf-Access-Authenticated-User-Email` header,前提是確保 Worker 永遠不會被跳過 Access 直接存取。選擇改為在 Worker 內驗證 `Cf-Access-Jwt-Assertion` 的 JWT 簽章(向 Access 的 JWKS endpoint 取公鑰,確認 aud/iss),即使日後 zone 設定或路由被誤改、Worker 被直接暴露,身份驗證依然成立,不依賴「網路拓樸永遠正確」這個隱性假設。代價是多一層簽章驗證邏輯與對外部 JWKS 的依賴(需處理快取/逾時)。
