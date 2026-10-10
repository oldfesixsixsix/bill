export type CategorySpendingItem = { categoryId: number; name: string; total: number }

export type CategorySpendingResponse = {
  kind: 'income' | 'expense'
  from?: string
  to?: string
  parentId?: number
  breakdown: CategorySpendingItem[]
}

export async function fetchCategorySpending(params: {
  from?: string
  to?: string
  parentId?: number | null
}): Promise<CategorySpendingResponse> {
  const query = new URLSearchParams()
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.parentId) query.set('parentId', String(params.parentId))

  const res = await fetch(`/api/charts/category-spending?${query}`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Failed to fetch category spending: ${res.status}`)
  }
  return res.json()
}
