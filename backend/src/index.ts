import { Hono } from 'hono'
import { getDb } from './db/client'
import { accounts } from './db/schema'
import { accessAuth, type AccessUser } from './middleware/access-auth'
import { accountsRoute } from './routes/accounts'
import { categoriesRoute } from './routes/categories'
import { transactionsRoute } from './routes/transactions'
import { eventsRoute } from './routes/events'

const app = new Hono<{ Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }>()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/health/db', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.select().from(accounts).all()
  return c.json({ accounts: rows })
})

app.use('/api/*', accessAuth())

app.get('/api/me', (c) => {
  return c.json({ email: c.get('accessUser').email })
})

app.route('/api/accounts', accountsRoute)
app.route('/api/categories', categoriesRoute)
app.route('/api/transactions', transactionsRoute)
app.route('/api/events', eventsRoute)

export default app
