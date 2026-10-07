// Empty string in dev: Vite's proxy (vite.config.ts) forwards /api to the local
// Worker, so a relative path is same-origin. In production, Pages and the Worker
// are on different *.pages.dev / *.workers.dev subdomains, so this must be set to
// the deployed Worker's absolute URL at build time (see .env.production.example).
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
