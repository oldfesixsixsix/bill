import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Jwt } from 'hono/utils/jwt'

export type AccessUser = { email: string }

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

// Verifies the signature on Cf-Access-Jwt-Assertion against Access's JWKS (ADR-0002) —
// trusting the header's email claim alone would silently become unsafe if the Worker
// were ever reachable without passing through Access first.
export const accessAuth = (): MiddlewareHandler<Env> => {
  return async (c, next) => {
    if (c.env.DEV_MODE === 'true') {
      c.set('accessUser', { email: c.env.DEV_USER_EMAIL || 'dev@example.com' })
      return next()
    }

    const token = c.req.header('Cf-Access-Jwt-Assertion')
    if (!token) {
      throw new HTTPException(401, { message: 'Missing Cf-Access-Jwt-Assertion header' })
    }

    const teamDomain = c.env.ACCESS_TEAM_DOMAIN
    const aud = c.env.ACCESS_AUD
    if (!teamDomain || !aud) {
      throw new HTTPException(500, { message: 'ACCESS_TEAM_DOMAIN / ACCESS_AUD not configured' })
    }

    let email: string | undefined
    try {
      // cf.cacheTtl lets Cloudflare's edge cache the JWKS response instead of
      // refetching Access's certs endpoint on every single request.
      const payload = await Jwt.verifyWithJwks(
        token,
        {
          jwks_uri: `https://${teamDomain}/cdn-cgi/access/certs`,
          verification: { iss: `https://${teamDomain}`, aud },
          allowedAlgorithms: ['RS256'],
        },
        { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit
      )
      email = typeof payload.email === 'string' ? payload.email : undefined
    } catch {
      throw new HTTPException(401, { message: 'Invalid Access token' })
    }

    if (!email) {
      throw new HTTPException(401, { message: 'Access token missing email claim' })
    }

    c.set('accessUser', { email })
    await next()
  }
}
