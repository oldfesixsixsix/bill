import { useEffect, useState } from 'react'
import { fetchTransactions, type Transaction } from '../api/transactions'
import type { Account } from '../api/accounts'

const TYPE_LABEL = { expense: '支出', income: '收入', transfer: '轉帳' } as const

function formatTwd(n: number) {
  return `NT$${n.toLocaleString('en-US')}`
}

export function TransactionList({
  accounts,
  refreshKey,
  onEdit,
}: {
  accounts: Account[]
  refreshKey: number
  onEdit: (tx: Transaction) => void
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTransactions()
      .then(setTransactions)
      .catch((e) => setError(e.message))
  }, [refreshKey])

  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? `#${id}`

  if (error) return <p role="alert">交易載入失敗:{error}</p>
  if (transactions.length === 0) return <p>還沒有交易紀錄</p>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>日期</th>
          <th style={{ textAlign: 'left' }}>類型</th>
          <th style={{ textAlign: 'left' }}>帳戶</th>
          <th style={{ textAlign: 'right' }}>金額</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => {
          const total = tx.items.reduce((sum, i) => sum + i.amount, 0)
          return (
            <tr key={tx.id}>
              <td>{tx.date}</td>
              <td>{TYPE_LABEL[tx.type]}</td>
              <td>
                {accountName(tx.accountId)}
                {tx.type === 'transfer' && tx.transferToAccountId ? ` → ${accountName(tx.transferToAccountId)}` : ''}
              </td>
              <td style={{ textAlign: 'right' }}>{formatTwd(total)}</td>
              <td>
                <button type="button" onClick={() => onEdit(tx)}>
                  編輯
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
