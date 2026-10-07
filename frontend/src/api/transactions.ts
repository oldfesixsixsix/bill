export type TransactionType = 'income' | 'expense' | 'transfer'

export type TransactionItem = {
  id: number
  transactionId: number
  categoryId: number | null
  drinkPresetId: number | null
  amount: number
  note: string | null
}

export type Transaction = {
  id: number
  type: TransactionType
  date: string
  accountId: number
  transferToAccountId: number | null
  eventId: number | null
  note: string | null
  createdAt: string
  items: TransactionItem[]
}

export type TransactionItemInput = {
  categoryId?: number
  drinkPresetId?: number
  amount: number
  note?: string
}

export type TransactionInput = {
  type: TransactionType
  date: string
  accountId: number
  transferToAccountId?: number
  eventId?: number
  note?: string
  items: TransactionItemInput[]
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/transactions', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`)
  const data = (await res.json()) as { transactions: Transaction[] }
  return data.transactions
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: { message?: string } }
    return body.message ?? body.error?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}

export async function updateTransaction(id: number, input: TransactionInput): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}
