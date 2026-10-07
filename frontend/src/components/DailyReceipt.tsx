import { useState } from 'react'
import { fetchDailyReceipt, type DailyReceiptResponse } from '../api/daily-receipt'

function formatTwd(n: number) {
  return `$${n.toLocaleString('en-US')}`
}

function formatDateLabel(date: string) {
  const [y, m, d] = date.split('-')
  return `${y}年${m}月${d}日`
}

function today() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function DailyReceipt() {
  const [date, setDate] = useState(today())
  const [receipt, setReceipt] = useState<DailyReceiptResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Manually triggered, not auto-fetched on date change (CONTEXT.md: DailyReceipt
  // is "按需產生,不走排程") — picking a date shouldn't by itself hit the API.
  function handleGenerate() {
    setLoading(true)
    setError(null)
    fetchDailyReceipt(date)
      .then(setReceipt)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  return (
    <section>
      <h2>每日收據</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" onClick={handleGenerate} disabled={loading}>
          {loading ? '產生中…' : '產生'}
        </button>
      </div>

      {error && <p role="alert">載入失敗:{error}</p>}

      {receipt && (
        <div
          style={{
            fontFamily: 'ui-monospace, Consolas, monospace',
            border: '1px dashed currentColor',
            borderRadius: 8,
            padding: '1.25rem',
            maxWidth: 320,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div>電子發票證明聯</div>
            <div>{receipt.invoiceNumber}</div>
            <div>{formatDateLabel(receipt.date)}</div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px dashed currentColor', margin: '0.75rem 0' }} />

          {receipt.items.length === 0 ? (
            <p style={{ textAlign: 'center' }}>這天沒有支出紀錄</p>
          ) : (
            <div>
              {receipt.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name}</span>
                  <span>{formatTwd(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px dashed currentColor', margin: '0.75rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>總計</span>
            <span>{formatTwd(receipt.total)}</span>
          </div>
        </div>
      )}
    </section>
  )
}
