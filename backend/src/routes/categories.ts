import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/client'
import { categories, transactionItems } from '../db/schema'
import type { AccessUser } from '../middleware/access-auth'

type Env = { Bindings: CloudflareBindings; Variables: { accessUser: AccessUser } }
type Db = ReturnType<typeof getDb>
type Kind = 'income' | 'expense'

const kindSchema = z.enum(['income', 'expense'])

const createCategorySchema = z.object({
  kind: kindSchema,
  name: z.string().trim().min(1),
  parentId: z.number().int().positive().optional(),
})

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  parentId: z.number().int().positive().nullable().optional(),
})

const listQuerySchema = z.object({
  kind: kindSchema,
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const categoriesRoute = new Hono<Env>()

// Category is at most two levels deep (CONTEXT.md): a parent must itself be
// top-level, and must belong to the same kind tree as the child being created.
async function assertValidParent(db: Db, parentId: number, kind: Kind) {
  const parent = await db.select().from(categories).where(eq(categories.id, parentId)).get()
  if (!parent) {
    throw new HTTPException(400, { message: 'parentId does not exist' })
  }
  if (parent.kind !== kind) {
    throw new HTTPException(400, { message: 'parent category belongs to a different kind (income/expense) tree' })
  }
  if (parent.parentId !== null) {
    throw new HTTPException(400, { message: 'parent category must be top-level (max two levels)' })
  }
}

categoriesRoute.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { kind } = c.req.valid('query')
  const db = getDb(c.env.DB)
  const rows = await db.select().from(categories).where(eq(categories.kind, kind)).all()

  const topLevel = rows.filter((r) => r.parentId === null)
  const tree = topLevel.map((parent) => ({
    ...parent,
    children: rows.filter((r) => r.parentId === parent.id),
  }))

  return c.json({ categories: tree })
})

categoriesRoute.post('/', zValidator('json', createCategorySchema), async (c) => {
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  if (input.parentId !== undefined) {
    await assertValidParent(db, input.parentId, input.kind)
  }

  const [row] = await db.insert(categories).values(input).returning()
  return c.json(row, 201)
})

categoriesRoute.patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateCategorySchema), async (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(categories).where(eq(categories.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Category not found' })
  }

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) {
      throw new HTTPException(400, { message: 'category cannot be its own parent' })
    }
    await assertValidParent(db, input.parentId, existing.kind)

    const hasChildren = await db.select().from(categories).where(eq(categories.parentId, id)).get()
    if (hasChildren) {
      throw new HTTPException(409, { message: 'category has children and cannot become a child itself' })
    }
  }

  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning()
  return c.json(row)
})

categoriesRoute.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const db = getDb(c.env.DB)

  const existing = await db.select().from(categories).where(eq(categories.id, id)).get()
  if (!existing) {
    throw new HTTPException(404, { message: 'Category not found' })
  }

  const hasChildren = await db.select().from(categories).where(eq(categories.parentId, id)).get()
  if (hasChildren) {
    throw new HTTPException(409, { message: 'Category has child categories and cannot be deleted' })
  }

  const hasItems = await db.select().from(transactionItems).where(eq(transactionItems.categoryId, id)).get()
  if (hasItems) {
    throw new HTTPException(409, { message: 'Category is used by transactions and cannot be deleted' })
  }

  await db.delete(categories).where(eq(categories.id, id)).run()
  return c.body(null, 204)
})
