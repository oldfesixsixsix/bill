export type Event = {
  id: number
  name: string
  startDate: string | null
  endDate: string | null
}

export async function fetchEvents(): Promise<Event[]> {
  const res = await fetch('/api/events', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`)
  const data = (await res.json()) as { events: Event[] }
  return data.events
}
