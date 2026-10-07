import { eq, and } from 'drizzle-orm'
import { transactions, transactionItems, categories } from '../db/schema'
import type { Db } from '../db/client'

// Pure decoration (CONTEXT.md: DailyReceipt) — no real invoice numbering scheme,
// no persistence, no lottery/legal meaning. A fresh number every request is the
// point: it can't be mistaken for something that needs to stay stable.
export function generateInvoiceNumber() {
  const letters = Array.from({ length: 2 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')
  const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
  return `${letters}-${digits}`
}

export type DailyReceiptItem = { name: string; amount: number }

// Only expense items show up — a receipt represents what was spent, not income
// or transfers between the user's own accounts.
export async function getDailyReceiptItems(db: Db, date: string): Promise<DailyReceiptItem[]> {
  const rows = await db
    .select({
      note: transactionItems.note,
      amount: transactionItems.amount,
      categoryName: categories.name,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .leftJoin(categories, eq(categories.id, transactionItems.categoryId))
    .where(and(eq(transactions.date, date), eq(transactions.type, 'expense')))
    .all()

  return rows.map((row) => ({
    name: row.note || row.categoryName || '未分類',
    amount: row.amount,
  }))
}
