// Merges into the generated CloudflareBindings (worker-configuration.d.ts).
// DEV_MODE / DEV_USER_EMAIL only ever come from .dev.vars (gitignored, local-only) —
// never from wrangler.jsonc vars, so production can't accidentally ship with auth disabled.
interface CloudflareBindings {
  DEV_MODE?: string
  DEV_USER_EMAIL?: string
  FRONTEND_ORIGIN?: string
}
