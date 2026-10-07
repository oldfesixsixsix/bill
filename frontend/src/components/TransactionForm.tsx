import { useEffect, useState } from 'react'
import type { Account } from '../api/accounts'
import { fetchCategories, flattenCategoryOptions } from '../api/categories'
import { fetchEvents, type Event } from '../api/events'
import { fetchDrinkPresets, type DrinkPreset } from '../api/drink-presets'
import { createTransaction, updateTransaction, type Transaction, type TransactionType, type TransactionInput } from '../api/transactions'

type ItemRow = { categoryId: string; drinkPresetId: string; amount: string; note: string }

const emptyItem: ItemRow = { categoryId: '', drinkPresetId: '', amount: '', note: '' }

function today() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function fromTransaction(tx: Transaction): { type: TransactionType; date: string; accountId: string; transferToAccountId: string; eventId: string; items: ItemRow[] } {
  return {
    type: tx.type,
    date: tx.date,
    accountId: String(tx.accountId),
    transferToAccountId: tx.transferToAccountId ? String(tx.transferToAccountId) : '',
    eventId: tx.eventId ? String(tx.eventId) : '',
    items: tx.items.map((i) => ({
      categoryId: i.categoryId ? String(i.categoryId) : '',
      drinkPresetId: i.drinkPresetId ? String(i.drinkPresetId) : '',
      amount: String(i.amount),
      note: i.note ?? '',
    })),
  }
}

export function TransactionForm({
  accounts,
  editing,
  onSaved,
  onCancelEdit,
}: {
  accounts: Account[]
  editing: Transaction | null
  onSaved: () => void
  onCancelEdit: () => void
}) {
  const [type, setType] = useState<TransactionType>('expense')
  const [date, setDate] = useState(today())
  const [accountId, setAccountId] = useState('')
  const [transferToAccountId, setTransferToAccountId] = useState('')
  const [eventId, setEventId] = useState('')
  const [items, setItems] = useState<ItemRow[]>([emptyItem])

  const [categoryOptions, setCategoryOptions] = useState<{ id: number; label: string }[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [drinkPresets, setDrinkPresets] = useState<DrinkPreset[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing) {
      const fields = fromTransaction(editing)
      setType(fields.type)
      setDate(fields.date)
      setAccountId(fields.accountId)
      setTransferToAccountId(fields.transferToAccountId)
      setEventId(fields.eventId)
      setItems(fields.items)
    } else {
      // Clears leftover values when leaving edit mode, so re-entering "新增交易"
      // doesn't silently carry over the previous edit's fields.
      resetForm()
    }
  }, [editing])

  useEffect(() => {
    fetchEvents().then(setEvents).catch(() => setEvents([]))
    fetchDrinkPresets().then(setDrinkPresets).catch(() => setDrinkPresets([]))
  }, [])

  useEffect(() => {
    if (type === 'transfer') {
      setCategoryOptions([])
      return
    }
    fetchCategories(type)
      .then((tree) => setCategoryOptions(flattenCategoryOptions(tree)))
      .catch(() => setCategoryOptions([]))
  }, [type])

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setType('expense')
    setDate(today())
    setAccountId('')
    setTransferToAccountId('')
    setEventId('')
    setItems([emptyItem])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input: TransactionInput = {
      type,
      date,
      accountId: Number(accountId),
      ...(type === 'transfer' && transferToAccountId ? { transferToAccountId: Number(transferToAccountId) } : {}),
      ...(eventId ? { eventId: Number(eventId) } : {}),
      items: items.map((item) => ({
        amount: Number(item.amount),
        ...(type !== 'transfer' && item.categoryId ? { categoryId: Number(item.categoryId) } : {}),
        ...(item.drinkPresetId ? { drinkPresetId: Number(item.drinkPresetId) } : {}),
        ...(item.note ? { note: item.note } : {}),
      })),
    }

    setSubmitting(true)
    try {
      if (editing) {
        await updateTransaction(editing.id, input)
        onCancelEdit()
      } else {
        await createTransaction(input)
        resetForm()
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
      <h3>{editing ? `編輯交易 #${editing.id}` : '新增交易'}</h3>

      <label>
        類型
        <select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          <option value="expense">支出</option>
          <option value="income">收入</option>
          <option value="transfer">轉帳</option>
        </select>
      </label>

      <label>
        日期
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <label>
        {type === 'transfer' ? '來源帳戶' : '帳戶'}
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
          <option value="">請選擇</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      {type === 'transfer' && (
        <label>
          目的帳戶
          <select value={transferToAccountId} onChange={(e) => setTransferToAccountId(e.target.value)} required>
            <option value="">請選擇</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        事件(選填)
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">無</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <legend>明細</legend>
        {items.map((item, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {type !== 'transfer' && (
              <select value={item.categoryId} onChange={(e) => updateItem(index, { categoryId: e.target.value })} required>
                <option value="">選擇類別</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              min={1}
              placeholder="金額"
              value={item.amount}
              onChange={(e) => updateItem(index, { amount: e.target.value })}
              style={{ width: '6rem' }}
              required
            />
            <select value={item.drinkPresetId} onChange={(e) => updateItem(index, { drinkPresetId: e.target.value })}>
              <option value="">非飲品</option>
              {drinkPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="備註(選填)"
              value={item.note}
              onChange={(e) => updateItem(index, { note: e.target.value })}
            />
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(index)}>
                移除
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addItem}>
          + 新增明細
        </button>
      </fieldset>

      {error && <p role="alert">儲存失敗:{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={submitting}>
          {submitting ? '儲存中…' : editing ? '儲存變更' : '新增交易'}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit}>
            取消編輯
          </button>
        )}
      </div>
    </form>
  )
}
