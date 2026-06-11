import { toBaseCents } from './money'
import type { Balance, Expense, ExpenseSplit, Settlement } from './types'

/**
 * Compute each member's net position in base-currency cents from the
 * ledger. Soft-deleted entries are ignored.
 *
 * Each share is converted to base individually with the expense's frozen
 * fx rate, and the payer is credited with the SUM of converted shares
 * (not the converted total), so balances always sum to exactly zero.
 */
export function computeBalances(
  memberIds: string[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  settlements: Settlement[],
): Balance[] {
  const balances = new Map<string, number>(memberIds.map((id) => [id, 0]))
  const add = (memberId: string, cents: number) => {
    if (!balances.has(memberId)) balances.set(memberId, 0)
    balances.set(memberId, balances.get(memberId)! + cents)
  }

  const splitsByExpense = new Map<string, ExpenseSplit[]>()
  for (const split of splits) {
    const list = splitsByExpense.get(split.expenseId)
    if (list) list.push(split)
    else splitsByExpense.set(split.expenseId, [split])
  }

  for (const expense of expenses) {
    if (expense.deletedAt !== null) continue
    for (const split of splitsByExpense.get(expense.id) ?? []) {
      const shareBase = toBaseCents(split.shareCents, expense.fxRateToBase)
      add(split.memberId, -shareBase)
      add(expense.paidBy, shareBase)
    }
  }

  for (const settlement of settlements) {
    if (settlement.deletedAt !== null) continue
    add(settlement.fromMember, settlement.amountCents)
    add(settlement.toMember, -settlement.amountCents)
  }

  return [...balances.entries()].map(([memberId, balanceCents]) => ({
    memberId,
    balanceCents,
  }))
}
