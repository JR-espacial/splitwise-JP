import { describe, expect, it } from 'vitest'
import { suggestSettlements } from '../settle'
import type { Balance, Transfer } from '../types'

const [A, B, C, D] = ['member-a', 'member-b', 'member-c', 'member-d'] as const

function applyTransfers(balances: Balance[], transfers: Transfer[]): Map<string, number> {
  const result = new Map(balances.map((b) => [b.memberId, b.balanceCents]))
  for (const t of transfers) {
    result.set(t.fromMember, result.get(t.fromMember)! + t.amountCents)
    result.set(t.toMember, result.get(t.toMember)! - t.amountCents)
  }
  return result
}

describe('suggestSettlements', () => {
  it('returns nothing when everyone is settled', () => {
    expect(
      suggestSettlements([
        { memberId: A, balanceCents: 0 },
        { memberId: B, balanceCents: 0 },
      ]),
    ).toEqual([])
  })

  it('settles a single debt directly', () => {
    const transfers = suggestSettlements([
      { memberId: A, balanceCents: 1500 },
      { memberId: B, balanceCents: -1500 },
    ])
    expect(transfers).toEqual([{ fromMember: B, toMember: A, amountCents: 1500 }])
  })

  it('matches the largest debtor with the largest creditor first', () => {
    const transfers = suggestSettlements([
      { memberId: A, balanceCents: 3000 },
      { memberId: B, balanceCents: 1000 },
      { memberId: C, balanceCents: -2500 },
      { memberId: D, balanceCents: -1500 },
    ])
    expect(transfers[0]).toEqual({ fromMember: C, toMember: A, amountCents: 2500 })
    const after = applyTransfers(
      [
        { memberId: A, balanceCents: 3000 },
        { memberId: B, balanceCents: 1000 },
        { memberId: C, balanceCents: -2500 },
        { memberId: D, balanceCents: -1500 },
      ],
      transfers,
    )
    expect([...after.values()].every((v) => v === 0)).toBe(true)
  })

  it('uses at most n-1 transfers', () => {
    const balances: Balance[] = [
      { memberId: A, balanceCents: 700 },
      { memberId: B, balanceCents: 300 },
      { memberId: C, balanceCents: -400 },
      { memberId: D, balanceCents: -600 },
    ]
    const transfers = suggestSettlements(balances)
    expect(transfers.length).toBeLessThanOrEqual(3)
    const after = applyTransfers(balances, transfers)
    expect([...after.values()].every((v) => v === 0)).toBe(true)
  })

  it('settles one-cent balances produced by rounding', () => {
    const balances: Balance[] = [
      { memberId: A, balanceCents: 1 },
      { memberId: B, balanceCents: 1 },
      { memberId: C, balanceCents: -2 },
    ]
    const transfers = suggestSettlements(balances)
    const after = applyTransfers(balances, transfers)
    expect([...after.values()].every((v) => v === 0)).toBe(true)
    expect(transfers.every((t) => t.amountCents > 0)).toBe(true)
  })

  it('does not invent transfers when balances do not sum to zero', () => {
    const transfers = suggestSettlements([
      { memberId: A, balanceCents: 100 },
      { memberId: B, balanceCents: -99 },
    ])
    expect(transfers).toEqual([{ fromMember: B, toMember: A, amountCents: 99 }])
  })
})
