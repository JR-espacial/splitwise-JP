import { describe, expect, it } from 'vitest'
import { computeBalances } from '../balances'
import { computeSplits } from '../split'
import { computeTripTotals } from '../totals'
import { suggestSettlements } from '../settle'
import type { Expense, Settlement } from '../types'

const members = ['a', 'b', 'c', 'd']
const expense = (id: string, paidBy: string, amountCents: number, currency: Expense['currency'], fxRateToBase: number): Expense => ({
  id, paidBy, amountCents, currency, fxRateToBase, baseCurrency: 'MXN', groupId: 'g', description: 'Test', expenseDate: '2026-09-03', splitType: 'equal', createdAt: '', updatedAt: '', deletedAt: null,
})

describe('MXN ledger', () => {
  it('settles EUR, HUF and Mexican card charges in integer Mexican cents', () => {
    const expenses = [expense('e1', 'a', 10000, 'EUR', 20), expense('e2', 'b', 400000, 'HUF', 0.05), expense('e3', 'd', 40000, 'MXN', 1)]
    const splits = expenses.flatMap(e => computeSplits({expenseId: e.id, amountCents: e.amountCents, paidBy: e.paidBy, splitType: 'equal', participants: members}))
    const balances = computeBalances(members, expenses, splits, [])
    expect(balances.map(b => b.balanceCents)).toEqual([135000, -45000, -65000, -25000])
    expect(computeTripTotals(expenses, splits).totalBaseCents).toBe(260000)
    const payments: Settlement[] = suggestSettlements(balances).map((t, i) => ({id: String(i), groupId:'g', ...t, baseCurrency:'MXN', createdAt:'', updatedAt:'', deletedAt:null}))
    expect(computeBalances(members, expenses, splits, payments).every(b => b.balanceCents === 0)).toBe(true)
  })
})
