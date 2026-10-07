import { useEffect, useState } from 'react'
import { fetchAccounts, type Account } from '../api/accounts'
import type { Transaction } from '../api/transactions'
import { AccountBalances } from './AccountBalances'
import { TransactionForm } from './TransactionForm'
import { TransactionList } from './TransactionList'

export function Bookkeeping() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  // Bumped after every save so account balances and the transaction list
  // re-fetch together, since one transaction affects both.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch((e) => setAccountsError(e.message))
  }, [refreshKey])

  return (
    <section>
      <h2>記帳</h2>

      {accountsError ? <p role="alert">帳戶載入失敗:{accountsError}</p> : <AccountBalances accounts={accounts} />}

      <div style={{ marginTop: '1.5rem' }}>
        <TransactionForm
          accounts={accounts}
          editing={editing}
          onSaved={() => setRefreshKey((k) => k + 1)}
          onCancelEdit={() => setEditing(null)}
        />
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <TransactionList accounts={accounts} refreshKey={refreshKey} onEdit={setEditing} />
      </div>
    </section>
  )
}
