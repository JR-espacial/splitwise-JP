export const CURRENCIES = ['EUR', 'CZK', 'MXN', 'USD', 'CHF'] as const
export type Currency = (typeof CURRENCIES)[number]

export type SplitType = 'equal' | 'subset' | 'exact'

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'lodging',
  'activities',
  'shopping',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export type ChangeAction = 'created' | 'updated' | 'deleted' | 'restored'

export interface LedgerChange {
  id: string
  memberId: string
  action: ChangeAction
  at: string
}

export interface Member {
  id: string
  groupId: string
  name: string
  color: string
  /** Login email (magic link). Null until migration 0003 has run. */
  email: string | null
  createdAt: string
}

export interface Expense {
  id: string
  groupId: string
  paidBy: string
  amountCents: number
  currency: Currency
  /** Frozen at capture time. 1 when currency === group base currency. */
  fxRateToBase: number
  description: string
  /** ISO date (yyyy-mm-dd). */
  expenseDate: string
  splitType: SplitType
  /** Optional for backwards compatibility with expenses captured before migration 0004. */
  category?: ExpenseCategory
  /** Compressed image data URL. Kept on the entity so receipts remain available offline. */
  receiptDataUrl?: string | null
  createdBy?: string | null
  updatedBy?: string | null
  changeLog?: LedgerChange[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ExpenseSplit {
  expenseId: string
  memberId: string
  shareCents: number
}

/** Always denominated in the group's base currency. */
export interface Settlement {
  id: string
  groupId: string
  fromMember: string
  toMember: string
  amountCents: number
  /** ISO date (yyyy-mm-dd). Falls back to createdAt for legacy rows. */
  settlementDate?: string
  createdBy?: string | null
  updatedBy?: string | null
  changeLog?: LedgerChange[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Net position in base-currency cents: positive = is owed, negative = owes. */
export interface Balance {
  memberId: string
  balanceCents: number
}

export interface Transfer {
  fromMember: string
  toMember: string
  amountCents: number
}
