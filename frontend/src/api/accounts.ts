export type Account = {
  id: number
  name: string
  initialBalance: number
  createdAt: string
  balance: number
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch('/api/accounts', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.status}`)
  const data = (await res.json()) as { accounts: Account[] }
  return data.accounts
}
