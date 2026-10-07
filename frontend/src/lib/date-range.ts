function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function monthRange(year: number, month: number) {
  const from = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${pad(month)}-${pad(lastDay)}`
  return { from, to }
}

export function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

export function currentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}
