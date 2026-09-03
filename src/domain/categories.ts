import type { ExpenseCategory } from './types'

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: 'Comida',
  transport: 'Transporte',
  lodging: 'Hospedaje',
  activities: 'Actividades',
  shopping: 'Compras',
  other: 'Otros',
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍽️',
  transport: '🚗',
  lodging: '🛏️',
  activities: '🎟️',
  shopping: '🛍️',
  other: '🧾',
}

export function expenseCategory(value: ExpenseCategory | undefined): ExpenseCategory {
  return value ?? 'other'
}
