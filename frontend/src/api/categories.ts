import { API_BASE } from './base'

export type Category = {
  id: number
  kind: 'income' | 'expense'
  parentId: number | null
  name: string
}

export type CategoryTreeNode = Category & { children: Category[] }

export async function fetchCategories(kind: 'income' | 'expense'): Promise<CategoryTreeNode[]> {
  const res = await fetch(`${API_BASE}/api/categories?kind=${kind}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`)
  const data = (await res.json()) as { categories: CategoryTreeNode[] }
  return data.categories
}

// Flattens the two-level tree into select options, labeling children as "parent > child"
// so the dropdown stays a single flat list instead of a nested menu.
export function flattenCategoryOptions(tree: CategoryTreeNode[]) {
  return tree.flatMap((parent) => [
    { id: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ id: child.id, label: `${parent.name} > ${child.name}` })),
  ])
}
