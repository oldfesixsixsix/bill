export type DrinkPreset = {
  id: number
  name: string
  caffeineMg: number
  sugarG: number
}

export async function fetchDrinkPresets(): Promise<DrinkPreset[]> {
  const res = await fetch('/api/drink-presets', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch drink presets: ${res.status}`)
  const data = (await res.json()) as { drinkPresets: DrinkPreset[] }
  return data.drinkPresets
}
