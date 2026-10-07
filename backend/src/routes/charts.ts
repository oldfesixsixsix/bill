import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db/client'
import { getCategorySpending } from '../services/category-spending'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const querySchema = z.object({
  kind: z.enum(['income', 'expense']).default('expense'),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  parentId: z.coerce.number().int().positive().optional(),
})

export const chartsRoute = new Hono<Env>()

chartsRoute.get('/category-spending', zValidator('query', querySchema), async (c) => {
  const params = c.req.valid('query')
  const db = getDb(c.env.DB)
  const breakdown = await getCategorySpending(db, params)
  return c.json({ ...params, breakdown })
})
