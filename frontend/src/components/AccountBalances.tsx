import type { Account } from '../api/accounts'

function formatTwd(n: number) {
  return `NT$${n.toLocaleString('en-US')}`
}

export function AccountBalances({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) return <p>還沒有帳戶</p>

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {accounts.map((a) => (
        <li key={a.id} style={{ border: '1px solid currentColor', borderRadius: 8, padding: '0.5rem 1rem' }}>
          <div>{a.name}</div>
          <strong>{formatTwd(a.balance)}</strong>
        </li>
      ))}
    </ul>
  )
}
