import { describe, expect, it } from 'vitest'
import { computeSplits } from '../split'
import { computeTripTotals } from '../totals'
import type { Expense, ExpenseSplit } from '../types'

const [A, B] = ['member-a', 'member-b'] as const

let counter = 0
function makeExpense(
  overrides: Partial<Expense> & Pick<Expense, 'paidBy' | 'amountCents'>,
): Expense {
  return {
    id: `expense-${++counter}`,
    groupId: 'g1',
    currency: 'EUR',
    fxRateToBase: 1,
    description: 'test',
    expenseDate: '2026-06-01',
    splitType: 'equal',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  }
}

function equalSplits(expense: Expense, participants: string[]): ExpenseSplit[] {
  return computeSplits({
    expenseId: expense.id,
    amountCents: expense.amountCents,
    paidBy: expense.paidBy,
    splitType: 'equal',
    participants,
  })
}

describe('computeTripTotals', () => {
  it('is zero on an empty ledger', () => {
    expect(computeTripTotals([], [])).toEqual({
      totalBaseCents: 0,
      expenseCount: 0,
      spentByMember: {},
    })
  })

  it('sums base-currency expenses and attributes shares per member', () => {
    const e1 = makeExpense({ paidBy: A, amountCents: 1001 })
    const totals = computeTripTotals([e1], equalSplits(e1, [A, B]))
    expect(totals.totalBaseCents).toBe(1001)
    expect(totals.expenseCount).toBe(1)
    expect(totals.spentByMember[A]).toBe(501) // remainder to the payer
    expect(totals.spentByMember[B]).toBe(500)
  })

  it('converts foreign shares with the frozen rate, consistent with balances', () => {
    const e1 = makeExpense({ paidBy: A, amountCents: 1001, currency: 'CZK', fxRateToBase: 0.04 })
    const totals = computeTripTotals([e1], equalSplits(e1, [A, B]))
    // round(501*0.04)=20, round(500*0.04)=20 — sum of converted shares.
    expect(totals.totalBaseCents).toBe(40)
    expect(totals.spentByMember[A]! + totals.spentByMember[B]!).toBe(totals.totalBaseCents)
  })

  it('ignores soft-deleted expenses and their splits', () => {
    const e1 = makeExpense({ paidBy: A, amountCents: 1000, deletedAt: '2026-06-02T00:00:00Z' })
    const e2 = makeExpense({ paidBy: B, amountCents: 500 })
    const splits = [...equalSplits(e1, [A, B]), ...equalSplits(e2, [A, B])]
    const totals = computeTripTotals([e1, e2], splits)
    expect(totals.totalBaseCents).toBe(500)
    expect(totals.expenseCount).toBe(1)
  })
})
