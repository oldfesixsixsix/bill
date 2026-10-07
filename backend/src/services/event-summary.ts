import { sql, eq, and } from 'drizzle-orm'
import { transactions, transactionItems } from '../db/schema'
import type { Db } from '../db/client'

// Event summarizes spending across Categories (CONTEXT.md: Event), so this totals
// by transaction type rather than breaking down by category. Transfers move money
// between the user's own accounts and aren't spending, so they're excluded from
// both totals but still counted in transactionCount.
export async function getEventSummary(db: Db, eventId: number) {
  const sumForType = async (type: 'income' | 'expense') => {
    const row = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactionItems.amount}), 0)` })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
      .where(and(eq(transactions.eventId, eventId), eq(transactions.type, type)))
      .get()
    return row?.total ?? 0
  }

  const countRow = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(eq(transactions.eventId, eventId))
    .get()

  return {
    totalExpense: await sumForType('expense'),
    totalIncome: await sumForType('income'),
    transactionCount: countRow?.count ?? 0,
  }
}
