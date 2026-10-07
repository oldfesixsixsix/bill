import { Hono } from 'hono'
import { getDb } from './db/client'
import { accounts } from './db/schema'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/health/db', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.select().from(accounts).all()
  return c.json({ accounts: rows })
})

export default app
