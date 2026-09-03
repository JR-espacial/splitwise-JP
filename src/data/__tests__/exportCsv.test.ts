import { describe, expect, it } from 'vitest'
import { buildLedgerCsv } from '../exportCsv'
import type { LedgerSnapshot } from '../repository'

const snapshot: LedgerSnapshot = {
  group: { id: 'g1', name: 'Europa 2026', baseCurrency: 'EUR', createdAt: '2026-01-01T00:00:00Z' },
  members: [
    { id: 'a', groupId: 'g1', name: 'Ana', color: '#fff', email: 'a@example.com', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', groupId: 'g1', name: 'Beto', color: '#000', email: 'b@example.com', createdAt: '2026-01-01T00:00:00Z' },
  ],
  expenses: [{
    id: 'e1', groupId: 'g1', paidBy: 'a', amountCents: 1234, currency: 'EUR', fxRateToBase: 1,
    description: 'Cena, centro', expenseDate: '2026-06-01', splitType: 'equal', category: 'food',
    receiptDataUrl: 'data:image/jpeg;base64,x', createdBy: 'a', updatedBy: 'b',
    createdAt: '2026-06-01T20:00:00Z', updatedAt: '2026-06-01T21:00:00Z', deletedAt: null,
  }],
  splits: [
    { expenseId: 'e1', memberId: 'a', shareCents: 617 },
    { expenseId: 'e1', memberId: 'b', shareCents: 617 },
  ],
  settlements: [{
    id: 's1', groupId: 'g1', fromMember: 'b', toMember: 'a', amountCents: 500,
    settlementDate: '2026-06-02', createdBy: 'b', updatedBy: 'b', createdAt: '2026-06-02T10:00:00Z',
    updatedAt: '2026-06-02T10:00:00Z', deletedAt: null,
  }],
}

describe('buildLedgerCsv', () => {
  it('exports expenses, splits, categories, authors and settlements', () => {
    const csv = buildLedgerCsv(snapshot)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Cena, centro"')
    expect(csv).toContain('Comida')
    expect(csv).toContain('Ana: 6.17 EUR | Beto: 6.17 EUR')
    expect(csv).toContain('Sí,Ana,Beto')
    expect(csv).toContain('Pago,2026-06-02,Liquidación')
  })

  it('neutralizes spreadsheet formulas from user-entered descriptions', () => {
    const csv = buildLedgerCsv({
      ...snapshot,
      expenses: [{ ...snapshot.expenses[0]!, description: '=HYPERLINK("bad")' }],
    })
    expect(csv).toContain("'=")
  })
})
