import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { accounts } from '../db/schema'
import { balanceExpr, accountHasTransactions } from '../services/account-balance'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }

const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  initialBalance: z.number().int().default(0),
})

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).optional(),
  initialBalance: z.number().int().optional(),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const accountsRoute = new Hono<Env>()

function accountColumns() {
  return {
    id: accounts.id,
    name: accounts.name,
    initialBalance: accounts.initialBalance,
    createdAt: accounts.createdAt,
    balance: balanceExpr(),
  }
}

accountsRoute.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.select(accountColumns()).from(accounts).orderBy(accounts.id).all()
  return c.json({ accounts: rows })
})

accountsRoute.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)
  const row = await db.select(accountColumns()).from(accounts).where(eq(accounts.id, id)).get()
  if (!row) {
    throw new HTTPException(404, { message: 'Account not found' })
  }
  return c.json(row)
})

accountsRoute.post('/', zValidator('json', createAccountSchema), async (c) => {
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)
  const [row] = await db.insert(accounts).values(input).returning()
  return c.json(row, 201)
})

accountsRoute.patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateAccountSchema), async (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(accounts).where(eq(accounts.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Account not found' })
  }

  const [row] = await db.update(accounts).set(input).where(eq(accounts.id, id)).returning()
  return c.json(row)
})

accountsRoute.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(accounts).where(eq(accounts.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Account not found' })
  }

  if (await accountHasTransactions(db, id)) {
    throw new HTTPException(409, { message: 'Account has transactions and cannot be deleted' })
  }

  await db.delete(accounts).where(eq(accounts.id, id)).run()
  return c.body(null, 204)
})
