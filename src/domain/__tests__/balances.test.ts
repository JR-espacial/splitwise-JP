import { describe, expect, it } from 'vitest'
import { computeBalances } from '../balances'
import { computeSplits } from '../split'
import type { Expense, ExpenseSplit, Settlement } from '../types'

const [A, B, C, D] = ['member-a', 'member-b', 'member-c', 'member-d'] as const
const MEMBERS = [A, B, C, D]

let counter = 0
function makeExpense(overrides: Partial<Expense> & Pick<Expense, 'paidBy' | 'amountCents'>): Expense {
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

function equalSplits(expense: Expense, participants: string[] = MEMBERS): ExpenseSplit[] {
  return computeSplits({
    expenseId: expense.id,
    amountCents: expense.amountCents,
    paidBy: expense.paidBy,
    splitType: 'equal',
    participants,
  })
}

function makeSettlement(
  overrides: Partial<Settlement> & Pick<Settlement, 'fromMember' | 'toMember' | 'amountCents'>,
): Settlement {
  return {
    id: `settlement-${++counter}`,
    groupId: 'g1',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  }
}

const balanceOf = (balances: { memberId: string; balanceCents: number }[], id: string) =>
  balances.find((b) => b.memberId === id)?.balanceCents

const total = (balances: { balanceCents: number }[]) =>
  balances.reduce((sum, b) => sum + b.balanceCents, 0)

describe('computeBalances', () => {
  it('returns zero balances with an empty ledger', () => {
    const balances = computeBalances(MEMBERS, [], [], [])
    expect(balances).toHaveLength(4)
    expect(balances.every((b) => b.balanceCents === 0)).toBe(true)
  })

  it('credits the payer and debits participants on an equal split', () => {
    const expense = makeExpense({ paidBy: A, amountCents: 4000 })
    const balances = computeBalances(MEMBERS, [expense], equalSplits(expense), [])
    expect(balanceOf(balances, A)).toBe(3000) // paid 4000, own share 1000
    expect(balanceOf(balances, B)).toBe(-1000)
    expect(total(balances)).toBe(0)
  })

  it('converts foreign-currency shares with the frozen fx rate, per share', () => {
    // 1001 CZK-cents split between A and B at 0.04: shares 501/500 →
    // base shares round(501*0.04)=20 and round(500*0.04)=20.
    const expense = makeExpense({
      paidBy: A,
      amountCents: 1001,
      currency: 'CZK',
      fxRateToBase: 0.04,
    })
    const splits = equalSplits(expense, [A, B])
    const balances = computeBalances(MEMBERS, [expense], splits, [])
    // A is credited with the sum of converted shares (40), minus own share (20).
    expect(balanceOf(balances, A)).toBe(20)
    expect(balanceOf(balances, B)).toBe(-20)
    expect(total(balances)).toBe(0)
  })

  it('always sums to zero across mixed currencies and rough fx rates', () => {
    const expenses = [
      makeExpense({ paidBy: A, amountCents: 33333, currency: 'CZK', fxRateToBase: 0.0405 }),
      makeExpense({ paidBy: B, amountCents: 9999, currency: 'USD', fxRateToBase: 0.9173 }),
      makeExpense({ paidBy: C, amountCents: 12345, currency: 'CHF', fxRateToBase: 1.0731 }),
      makeExpense({ paidBy: D, amountCents: 777, currency: 'MXN', fxRateToBase: 0.0501 }),
    ]
    const splits = expenses.flatMap((e) => equalSplits(e))
    const balances = computeBalances(MEMBERS, expenses, splits, [])
    expect(total(balances)).toBe(0)
  })

  it('ignores soft-deleted expenses and settlements', () => {
    const expense = makeExpense({
      paidBy: A,
      amountCents: 4000,
      deletedAt: '2026-06-02T00:00:00Z',
    })
    const settlement = makeSettlement({
      fromMember: B,
      toMember: A,
      amountCents: 500,
      deletedAt: '2026-06-02T00:00:00Z',
    })
    const balances = computeBalances(MEMBERS, [expense], equalSplits(expense), [settlement])
    expect(balances.every((b) => b.balanceCents === 0)).toBe(true)
  })

  it('applies settlements: paying down a debt moves both balances toward zero', () => {
    const expense = makeExpense({ paidBy: A, amountCents: 4000 })
    const settlement = makeSettlement({ fromMember: B, toMember: A, amountCents: 1000 })
    const balances = computeBalances(MEMBERS, [expense], equalSplits(expense), [settlement])
    expect(balanceOf(balances, A)).toBe(2000)
    expect(balanceOf(balances, B)).toBe(0)
    expect(total(balances)).toBe(0)
  })

  it('handles a payer who is not a participant (subset split)', () => {
    const expense = makeExpense({ paidBy: D, amountCents: 1000, splitType: 'subset' })
    const splits = computeSplits({
      expenseId: expense.id,
      amountCents: 1000,
      paidBy: D,
      splitType: 'subset',
      participants: [A, B, C],
    })
    const balances = computeBalances(MEMBERS, [expense], splits, [])
    expect(balanceOf(balances, D)).toBe(1000)
    expect(balanceOf(balances, A)).toBe(-334)
    expect(total(balances)).toBe(0)
  })
})
