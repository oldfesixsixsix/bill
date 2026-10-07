import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sql, eq, and, gte, lte, isNotNull, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { transactions, transactionItems, drinkPresets } from '../db/schema'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const querySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  groupBy: z.enum(['day', 'week']).default('day'),
})

export const drinkIntakeRoute = new Hono<Env>()

// v1 only shows cumulative totals, no daily-limit warnings (CONTEXT.md: DrinkPreset).
// "week" buckets use SQLite's %Y-%W (Monday-start week number) as a simple label —
// not a strict ISO week, but good enough for a rollup chart.
drinkIntakeRoute.get('/summary', zValidator('query', querySchema), async (c) => {
  const { from, to, groupBy } = c.req.valid('query')
  const db = getDb(c.env.DB)

  const period =
    groupBy === 'week' ? sql<string>`strftime('%Y-W%W', ${transactions.date})` : sql<string>`${transactions.date}`

  const conditions: SQL[] = [isNotNull(transactionItems.drinkPresetId)]
  if (from) conditions.push(gte(transactions.date, from))
  if (to) conditions.push(lte(transactions.date, to))

  const buckets = await db
    .select({
      period,
      caffeineMg: sql<number>`COALESCE(SUM(${drinkPresets.caffeineMg}), 0)`,
      sugarG: sql<number>`COALESCE(SUM(${drinkPresets.sugarG}), 0)`,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .innerJoin(drinkPresets, eq(drinkPresets.id, transactionItems.drinkPresetId))
    .where(and(...conditions))
    .groupBy(period)
    .orderBy(period)
    .all()

  const totals = buckets.reduce(
    (acc, b) => ({ caffeineMg: acc.caffeineMg + b.caffeineMg, sugarG: acc.sugarG + b.sugarG }),
    { caffeineMg: 0, sugarG: 0 }
  )

  return c.json({ groupBy, buckets, totalCaffeineMg: totals.caffeineMg, totalSugarG: totals.sugarG })
})
