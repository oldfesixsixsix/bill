import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getDb } from './db/client'
import { accounts } from './db/schema'
import { accessAuth, type AccessUser } from './middleware/access-auth'
import { accountsRoute } from './routes/accounts'
import { categoriesRoute } from './routes/categories'
import { transactionsRoute } from './routes/transactions'
import { eventsRoute } from './routes/events'
import { drinkPresetsRoute } from './routes/drink-presets'
import { drinkIntakeRoute } from './routes/drink-intake'
import { chartsRoute } from './routes/charts'
import { dailyReceiptRoute } from './routes/daily-receipt'

const app = new Hono<{ Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }>()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/health/db', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.select().from(accounts).all()
  return c.json({ accounts: rows })
})

// credentials: true + an explicit origin (not '*') because the browser needs to
// send Access's CF_Authorization cookie cross-origin once Pages and this Worker
// are deployed on different hostnames (issue #12).
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => c.env.FRONTEND_ORIGIN ?? origin,
    credentials: true,
  })
)
app.use('/api/*', accessAuth())

app.get('/api/me', (c) => {
  return c.json({ email: c.get('accessUser').email })
})

app.route('/api/accounts', accountsRoute)
app.route('/api/categories', categoriesRoute)
app.route('/api/transactions', transactionsRoute)
app.route('/api/events', eventsRoute)
app.route('/api/drink-presets', drinkPresetsRoute)
app.route('/api/drink-intake', drinkIntakeRoute)
app.route('/api/charts', chartsRoute)
app.route('/api/daily-receipt', dailyReceiptRoute)

export default app
