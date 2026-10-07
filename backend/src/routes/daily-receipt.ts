import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db/client'
import { generateInvoiceNumber, getDailyReceiptItems } from '../services/daily-receipt'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
})

export const dailyReceiptRoute = new Hono<Env>()

dailyReceiptRoute.get('/', zValidator('query', querySchema), async (c) => {
  const { date } = c.req.valid('query')
  const db = getDb(c.env.DB)

  const items = await getDailyReceiptItems(db, date)
  const total = items.reduce((sum, item) => sum + item.amount, 0)

  return c.json({
    date,
    invoiceNumber: generateInvoiceNumber(),
    items,
    total,
  })
})
