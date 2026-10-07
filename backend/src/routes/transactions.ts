import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { eq, and, gte, lte, inArray, desc, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { transactions, transactionItems, accounts, categories, events, drinkPresets } from '../db/schema'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }
type Db = ReturnType<typeof getDb>

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const itemSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  drinkPresetId: z.number().int().positive().optional(),
  amount: z.number().int().positive(),
  note: z.string().trim().optional(),
})

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  date: dateSchema,
  accountId: z.number().int().positive(),
  transferToAccountId: z.number().int().positive().optional(),
  eventId: z.number().int().positive().optional(),
  note: z.string().trim().optional(),
  items: z.array(itemSchema).min(1),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const listQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  accountId: z.coerce.number().int().positive().optional(),
  eventId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
})

export const transactionsRoute = new Hono<Env>()

async function assertAccountExists(db: Db, id: number, label: string) {
  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get()
  if (!row) {
    throw new HTTPException(400, { message: `${label} does not reference an existing account` })
  }
}

// Cross-checks the Transaction/TransactionItem business rules that zod alone can't
// express (ADR-0001): transfer items never carry a category, income/expense items
// always do and must match the transaction's own kind.
async function validateTransactionInput(db: Db, input: z.infer<typeof transactionSchema>) {
  if (input.type === 'transfer') {
    if (!input.transferToAccountId) {
      throw new HTTPException(400, { message: 'transferToAccountId is required for transfer transactions' })
    }
    if (input.transferToAccountId === input.accountId) {
      throw new HTTPException(400, { message: 'transferToAccountId must differ from accountId' })
    }
    await assertAccountExists(db, input.transferToAccountId, 'transferToAccountId')
    if (input.items.some((item) => item.categoryId !== undefined)) {
      throw new HTTPException(400, { message: 'transfer items must not have a categoryId' })
    }
  } else {
    if (input.transferToAccountId !== undefined) {
      throw new HTTPException(400, { message: 'transferToAccountId is only valid for transfer transactions' })
    }
    for (const item of input.items) {
      if (item.categoryId === undefined) {
        throw new HTTPException(400, { message: `${input.type} items must have a categoryId` })
      }
      const category = await db.select().from(categories).where(eq(categories.id, item.categoryId)).get()
      if (!category) {
        throw new HTTPException(400, { message: `categoryId ${item.categoryId} does not exist` })
      }
      if (category.kind !== input.type) {
        throw new HTTPException(400, { message: `categoryId ${item.categoryId} belongs to the ${category.kind} tree, not ${input.type}` })
      }
    }
  }

  await assertAccountExists(db, input.accountId, 'accountId')

  if (input.eventId !== undefined) {
    const event = await db.select().from(events).where(eq(events.id, input.eventId)).get()
    if (!event) {
      throw new HTTPException(400, { message: 'eventId does not reference an existing event' })
    }
  }

  for (const item of input.items) {
    if (item.drinkPresetId !== undefined) {
      const preset = await db.select().from(drinkPresets).where(eq(drinkPresets.id, item.drinkPresetId)).get()
      if (!preset) {
        throw new HTTPException(400, { message: `drinkPresetId ${item.drinkPresetId} does not exist` })
      }
    }
  }
}

async function withItems<T extends { id: number }>(db: Db, rows: T[]) {
  if (rows.length === 0) return rows.map((row) => ({ ...row, items: [] }))
  const ids = rows.map((row) => row.id)
  const items = await db.select().from(transactionItems).where(inArray(transactionItems.transactionId, ids)).all()
  return rows.map((row) => ({ ...row, items: items.filter((item) => item.transactionId === row.id) }))
}

transactionsRoute.get('/', zValidator('query', listQuerySchema), async (c) => {
  const filters = c.req.valid('query')
  const db = getDb(c.env.DB)

  const conditions: SQL[] = []
  if (filters.from) conditions.push(gte(transactions.date, filters.from))
  if (filters.to) conditions.push(lte(transactions.date, filters.to))
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId))
  if (filters.eventId) conditions.push(eq(transactions.eventId, filters.eventId))

  if (filters.categoryId) {
    const matches = await db
      .select({ transactionId: transactionItems.transactionId })
      .from(transactionItems)
      .where(eq(transactionItems.categoryId, filters.categoryId))
      .all()
    const ids = matches.map((m) => m.transactionId)
    conditions.push(ids.length > 0 ? inArray(transactions.id, ids) : eq(transactions.id, -1))
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .all()

  return c.json({ transactions: await withItems(db, rows) })
})

transactionsRoute.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)
  const row = await db.select().from(transactions).where(eq(transactions.id, id)).get()
  if (!row) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }
  const [withItemsRow] = await withItems(db, [row])
  return c.json(withItemsRow)
})

transactionsRoute.post('/', zValidator('json', transactionSchema), async (c) => {
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  await validateTransactionInput(db, input)

  const { items, ...header } = input
  const [transaction] = await db.insert(transactions).values(header).returning()

  // Two round trips, not a single atomic batch: D1 batch statements can't reference
  // a prior statement's generated id, and items need the header's id. If this insert
  // fails, roll back the orphaned header manually rather than leaving it dangling.
  try {
    const insertedItems = await db
      .insert(transactionItems)
      .values(items.map((item) => ({ ...item, transactionId: transaction.id })))
      .returning()
    return c.json({ ...transaction, items: insertedItems }, 201)
  } catch (e) {
    await db.delete(transactions).where(eq(transactions.id, transaction.id)).run()
    throw e
  }
})

transactionsRoute.patch('/:id', zValidator('param', idParamSchema), zValidator('json', transactionSchema), async (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(transactions).where(eq(transactions.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }

  await validateTransactionInput(db, input)

  const { items, ...header } = input
  const [transaction] = await db.update(transactions).set(header).where(eq(transactions.id, id)).returning()
  await db.delete(transactionItems).where(eq(transactionItems.transactionId, id)).run()
  const insertedItems = await db
    .insert(transactionItems)
    .values(items.map((item) => ({ ...item, transactionId: id })))
    .returning()

  return c.json({ ...transaction, items: insertedItems })
})

transactionsRoute.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(transactions).where(eq(transactions.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }

  await db.delete(transactions).where(eq(transactions.id, id)).run()
  return c.body(null, 204)
})
