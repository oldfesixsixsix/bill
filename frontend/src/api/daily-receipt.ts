import { API_BASE } from './base'

export type DailyReceiptItem = { name: string; amount: number }

export type DailyReceiptResponse = {
  date: string
  invoiceNumber: string
  items: DailyReceiptItem[]
  total: number
}

export async function fetchDailyReceipt(date: string): Promise<DailyReceiptResponse> {
  const res = await fetch(`${API_BASE}/api/daily-receipt?date=${date}`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Failed to fetch daily receipt: ${res.status}`)
  }
  return res.json()
}
