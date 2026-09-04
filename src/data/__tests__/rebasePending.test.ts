import { describe, expect, it } from 'vitest'
import { rebasePending } from '../rebasePending'
import type { OutboxEntry } from '../db'
import type { Group } from '../rows'

const group: Group = { id: '11111111-1111-4111-8111-111111111111', baseCurrency: 'MXN', name: 'Trip', createdAt: '' }
const pending: OutboxEntry = { kind: 'expense', seq: 7, entityId: 'e1', splits: [{expenseId:'e1',memberId:'a',shareCents:12345}], expense: {
  id:'e1',groupId:group.id,paidBy:'a',amountCents:12345,currency:'EUR',fxRateToBase:1,description:'Offline',expenseDate:'2026-09-03',splitType:'equal',createdAt:'',updatedAt:'',deletedAt:null,
} }

describe('rebasePending', () => {
  it('preserves the local expense, splits, queue identity and frozen conversion', () => {
    const result = rebasePending(pending, group)
    expect(result.seq).toBe(7)
    expect(result.kind === 'expense' && result.splits).toEqual(pending.splits)
    expect(result.kind === 'expense' && result.expense).toEqual({...pending.expense, baseCurrency:'MXN',fxRateToBase:19.7593})
    expect(rebasePending(result, group)).toBe(result)
    expect(pending.expense.fxRateToBase).toBe(1)
  })
  it('keeps an original MXN card charge unchanged and sets its rate to 1', () => {
    const result = rebasePending({...pending,expense:{...pending.expense,currency:'MXN',fxRateToBase:0.05}}, group)
    expect(result.kind === 'expense' && result.expense.fxRateToBase).toBe(1)
  })
  it('converts pending payments to Mexican cents exactly, even at a half-cent tie', () => {
    const payment: OutboxEntry = {kind:'settlement',entityId:'p1',seq:8,settlement:{id:'p1',groupId:group.id,fromMember:'a',toMember:'b',amountCents:5000,createdAt:'',updatedAt:'',deletedAt:null}}
    const result = rebasePending(payment,group)
    expect(result.kind === 'settlement' && result.settlement.amountCents).toBe(98797)
    expect(rebasePending(result,group)).toBe(result)
  })
  it('refuses an unknown conversion instead of guessing', () => {
    expect(() => rebasePending(pending,{...group,baseCurrency:'CHF'})).toThrow('requieren revisión')
  })
})
