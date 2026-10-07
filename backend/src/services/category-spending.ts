import { eq, and, gte, lte, type SQL } from 'drizzle-orm'
import { categories, transactions, transactionItems } from '../db/schema'
import type { Db } from '../db/client'

type Kind = 'income' | 'expense'

export type CategorySpendingParams = {
  kind: Kind
  from?: string
  to?: string
  parentId?: number
}

// Default view groups by top-level category (CONTEXT.md chart decision: parent by
// default, drill into children on click). Grouping happens in application code
// rather than SQL, since the category tree is small (max two levels) and this
// keeps the root-category-name lookup simple.
export async function getCategorySpending(db: Db, params: CategorySpendingParams) {
  const { kind, from, to, parentId } = params

  const allCategories = await db.select().from(categories).where(eq(categories.kind, kind)).all()
  const categoryById = new Map(allCategories.map((c) => [c.id, c]))

  const conditions: SQL[] = [eq(transactions.type, kind)]
  if (from) conditions.push(gte(transactions.date, from))
  if (to) conditions.push(lte(transactions.date, to))

  const items = await db
    .select({ categoryId: transactionItems.categoryId, amount: transactionItems.amount })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(and(...conditions))
    .all()

  const totals = new Map<number, number>()

  for (const item of items) {
    if (item.categoryId === null) continue
    const category = categoryById.get(item.categoryId)
    if (!category) continue

    if (parentId !== undefined) {
      // Drill-down: only count items on this exact parent or its direct children.
      if (category.id !== parentId && category.parentId !== parentId) continue
      totals.set(category.id, (totals.get(category.id) ?? 0) + item.amount)
    } else {
      const rootId = category.parentId ?? category.id
      totals.set(rootId, (totals.get(rootId) ?? 0) + item.amount)
    }
  }

  const breakdown = [...totals.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      name: categoryById.get(categoryId)?.name ?? '(unknown)',
      total,
    }))
    .sort((a, b) => b.total - a.total)

  return breakdown
}
