import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

// Balance is derived, not stored (CONTEXT.md: Account) — initial_balance plus every
// TransactionItem that touches this account, signed by which side of the transaction
// it's on: income adds, expense subtracts, transfer subtracts from the source account
// (transactions.account_id) and adds to the destination (transactions.transfer_to_account_id).
const BALANCE_DELTA = sql<number>`COALESCE((
  SELECT SUM(
    CASE
      WHEN t.type = 'income' THEN ti.amount
      WHEN t.type = 'expense' THEN -ti.amount
      WHEN t.type = 'transfer' AND t.account_id = accounts.id THEN -ti.amount
      WHEN t.type = 'transfer' AND t.transfer_to_account_id = accounts.id THEN ti.amount
      ELSE 0
    END
  )
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE t.account_id = accounts.id OR t.transfer_to_account_id = accounts.id
), 0)`

export function balanceExpr() {
  return sql<number>`accounts.initial_balance + ${BALANCE_DELTA}`
}

export async function accountHasTransactions(db: Db, accountId: number): Promise<boolean> {
  const row = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) AS count FROM transactions
    WHERE account_id = ${accountId} OR transfer_to_account_id = ${accountId}
  `)
  return (row?.count ?? 0) > 0
}
