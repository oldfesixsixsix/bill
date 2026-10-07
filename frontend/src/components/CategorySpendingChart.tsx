import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarRectangleItem } from 'recharts'
import { fetchCategorySpending, type CategorySpendingItem } from '../api/client'
import { currentYearMonth, monthRange, yearRange } from '../lib/date-range'

type RangeMode = 'month' | 'year' | 'custom'

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

function formatTwd(n: number) {
  return `NT$${n.toLocaleString('en-US')}`
}

export function CategorySpendingChart() {
  const initial = currentYearMonth()
  const [rangeMode, setRangeMode] = useState<RangeMode>('month')
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [customFrom, setCustomFrom] = useState(monthRange(initial.year, initial.month).from)
  const [customTo, setCustomTo] = useState(monthRange(initial.year, initial.month).to)

  // null = top-level (grouped by parent category); set = drilled into one parent's children.
  const [parentId, setParentId] = useState<number | null>(null)
  const [parentName, setParentName] = useState<string | null>(null)

  const [breakdown, setBreakdown] = useState<CategorySpendingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { from, to } =
    rangeMode === 'month' ? monthRange(year, month) : rangeMode === 'year' ? yearRange(year) : { from: customFrom, to: customTo }

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchCategorySpending({ from, to, parentId })
      .then((res) => setBreakdown(res.breakdown))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [from, to, parentId])

  const total = useMemo(() => breakdown.reduce((sum, b) => sum + b.total, 0), [breakdown])

  function handleBarClick(bar: BarRectangleItem) {
    if (parentId !== null) return // already drilled in; no third level
    const item = bar.payload as CategorySpendingItem | undefined
    if (!item) return
    setParentId(item.categoryId)
    setParentName(item.name)
  }

  function handleBack() {
    setParentId(null)
    setParentName(null)
  }

  return (
    <section>
      <h2>類別開銷</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setRangeMode('month')} disabled={rangeMode === 'month'}>
          本月
        </button>
        <button type="button" onClick={() => setRangeMode('year')} disabled={rangeMode === 'year'}>
          今年
        </button>
        <button type="button" onClick={() => setRangeMode('custom')} disabled={rangeMode === 'custom'}>
          自訂區間
        </button>

        {rangeMode === 'month' && (
          <input
            type="month"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              setYear(y)
              setMonth(m)
            }}
          />
        )}
        {rangeMode === 'year' && (
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '6rem' }} />
        )}
        {rangeMode === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span>至</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      {parentId !== null && (
        <div style={{ marginBottom: '1rem' }}>
          <button type="button" onClick={handleBack}>
            ← 返回母類別
          </button>
          <strong style={{ marginLeft: '0.5rem' }}>{parentName}</strong>
        </div>
      )}

      {loading && <p>載入中…</p>}
      {error && <p role="alert">載入失敗:{error}</p>}

      {!loading && !error && breakdown.length === 0 && <p>這段期間沒有資料</p>}

      {!loading && !error && breakdown.length > 0 && (
        <>
          <p>
            總計:<strong>{formatTwd(total)}</strong>
          </p>
          <ResponsiveContainer width="100%" height={Math.max(200, breakdown.length * 48)}>
            <BarChart data={breakdown} layout="vertical" margin={{ left: 24, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatTwd} />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip formatter={(value) => formatTwd(Number(value))} />
              <Bar
                dataKey="total"
                onClick={handleBarClick}
                cursor={parentId === null ? 'pointer' : 'default'}
                radius={4}
              >
                {breakdown.map((entry, index) => (
                  <Cell key={entry.categoryId} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  )
}
