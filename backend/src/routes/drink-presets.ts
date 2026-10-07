import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { drinkPresets, transactionItems } from '../db/schema'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

const createSchema = z.object({
  name: z.string().trim().min(1),
  caffeineMg: z.number().int().nonnegative().default(0),
  sugarG: z.number().nonnegative().default(0),
})

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  caffeineMg: z.number().int().nonnegative().optional(),
  sugarG: z.number().nonnegative().optional(),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const drinkPresetsRoute = new Hono<Env>()

drinkPresetsRoute.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.select().from(drinkPresets).orderBy(drinkPresets.id).all()
  return c.json({ drinkPresets: rows })
})

drinkPresetsRoute.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)
  const row = await db.select().from(drinkPresets).where(eq(drinkPresets.id, id)).get()
  if (!row) {
    throw new HTTPException(404, { message: 'DrinkPreset not found' })
  }
  return c.json(row)
})

drinkPresetsRoute.post('/', zValidator('json', createSchema), async (c) => {
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)
  const [row] = await db.insert(drinkPresets).values(input).returning()
  return c.json(row, 201)
})

drinkPresetsRoute.patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateSchema), async (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(drinkPresets).where(eq(drinkPresets.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'DrinkPreset not found' })
  }

  const [row] = await db.update(drinkPresets).set(input).where(eq(drinkPresets.id, id)).returning()
  return c.json(row)
})

drinkPresetsRoute.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(drinkPresets).where(eq(drinkPresets.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'DrinkPreset not found' })
  }

  const used = await db.select().from(transactionItems).where(eq(transactionItems.drinkPresetId, id)).get()
  if (used) {
    throw new HTTPException(409, { message: 'DrinkPreset is used by transactions and cannot be deleted' })
  }

  await db.delete(drinkPresets).where(eq(drinkPresets.id, id)).run()
  return c.body(null, 204)
})
