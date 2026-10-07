import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { events, transactions } from '../db/schema'
import { getEventSummary } from '../services/event-summary'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const createEventSchema = z
  .object({
    name: z.string().trim().min(1),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  })

const updateEventSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const eventsRoute = new Hono<Env>()

eventsRoute.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.select().from(events).orderBy(events.id).all()
  return c.json({ events: rows })
})

eventsRoute.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)
  const row = await db.select().from(events).where(eq(events.id, id)).get()
  if (!row) {
    throw new HTTPException(404, { message: 'Event not found' })
  }
  return c.json(row)
})

eventsRoute.get('/:id/summary', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)
  const event = await db.select().from(events).where(eq(events.id, id)).get()
  if (!event) {
    throw new HTTPException(404, { message: 'Event not found' })
  }
  const summary = await getEventSummary(db, id)
  return c.json({ event, ...summary })
})

eventsRoute.post('/', zValidator('json', createEventSchema), async (c) => {
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)
  const [row] = await db.insert(events).values(input).returning()
  return c.json(row, 201)
})

eventsRoute.patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateEventSchema), async (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(events).where(eq(events.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Event not found' })
  }

  const merged = { ...existing, ...input }
  if (merged.startDate && merged.endDate && merged.startDate > merged.endDate) {
    throw new HTTPException(400, { message: 'endDate must not be before startDate' })
  }

  const [row] = await db.update(events).set(input).where(eq(events.id, id)).returning()
  return c.json(row)
})

eventsRoute.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(events).where(eq(events.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Event not found' })
  }

  // Event is a lightweight tag (CONTEXT.md), not a financial record — deleting it
  // un-tags its transactions rather than blocking the delete or touching the money.
  await db.update(transactions).set({ eventId: null }).where(eq(transactions.eventId, id)).run()
  await db.delete(events).where(eq(events.id, id)).run()
  return c.body(null, 204)
})
