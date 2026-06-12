import { toBaseCents } from './money'
import type { Expense, ExpenseSplit } from './types'

export interface TripTotals {
  /** Sum of all non-deleted expenses in base cents. */
  totalBaseCents: number
  expenseCount: number
  /** Base cents consumed (sum of own shares) per member id. */
  spentByMember: Record<string, number>
}

/**
 * Trip spending totals in base currency. Each share is converted
 * individually with the expense's frozen fx rate — the same rule as
 * computeBalances — so the total always equals the sum of member spends.
 */
export function computeTripTotals(expenses: Expense[], splits: ExpenseSplit[]): TripTotals {
  const live = new Map(
    expenses.filter((e) => e.deletedAt === null).map((e) => [e.id, e]),
  )
  let totalBaseCents = 0
  const spentByMember: Record<string, number> = {}
  for (const split of splits) {
    const expense = live.get(split.expenseId)
    if (!expense) continue
    const shareBase = toBaseCents(split.shareCents, expense.fxRateToBase)
    totalBaseCents += shareBase
    spentByMember[split.memberId] = (spentByMember[split.memberId] ?? 0) + shareBase
  }
  return { totalBaseCents, expenseCount: live.size, spentByMember }
}
