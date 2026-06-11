export const CURRENCIES = ['EUR', 'CZK', 'MXN', 'USD', 'CHF'] as const
export type Currency = (typeof CURRENCIES)[number]

export type SplitType = 'equal' | 'subset' | 'exact'

export interface Member {
  id: string
  groupId: string
  name: string
  color: string
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
