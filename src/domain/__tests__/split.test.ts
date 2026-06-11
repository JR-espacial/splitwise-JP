import { describe, expect, it } from 'vitest'
import { computeSplits, SplitError } from '../split'

const [A, B, C, D] = ['member-a', 'member-b', 'member-c', 'member-d']
const ALL = [A!, B!, C!, D!]

const sum = (splits: { shareCents: number }[]) =>
  splits.reduce((total, s) => total + s.shareCents, 0)

describe('computeSplits — equal', () => {
  it('splits evenly when divisible', () => {
    const splits = computeSplits({
      expenseId: 'e1',
      amountCents: 4000,
      paidBy: A!,
      splitType: 'equal',
      participants: ALL,
    })
    expect(splits.map((s) => s.shareCents)).toEqual([1000, 1000, 1000, 1000])
  })

  it('assigns the remainder to the payer', () => {
    const splits = computeSplits({
      expenseId: 'e1',
      amountCents: 1001,
      paidBy: B!,
      splitType: 'equal',
      participants: ALL,
    })
    const byMember = Object.fromEntries(splits.map((s) => [s.memberId, s.shareCents]))
    expect(byMember[B!]).toBe(251) // 250 + remainder of 1
    expect(byMember[A!]).toBe(250)
    expect(sum(splits)).toBe(1001)
  })

  it('handles remainder of n-1 cents', () => {
    const splits = computeSplits({
      expenseId: 'e1',
      amountCents: 1003,
      paidBy: A!,
      splitType: 'equal',
      participants: ALL,
    })
    const byMember = Object.fromEntries(splits.map((s) => [s.memberId, s.shareCents]))
    expect(byMember[A!]).toBe(253)
    expect(sum(splits)).toBe(1003)
  })
})

describe('computeSplits — subset', () => {
  it('splits among the subset only', () => {
    const splits = computeSplits({
      expenseId: 'e1',
      amountCents: 900,
      paidBy: A!,
      splitType: 'subset',
      participants: [A!, B!, C!],
    })
    expect(splits).toHaveLength(3)
    expect(splits.map((s) => s.shareCents)).toEqual([300, 300, 300])
  })

  it('falls back to the first participant when the payer is outside the subset', () => {
    const splits = computeSplits({
      expenseId: 'e1',
      amountCents: 1000,
      paidBy: D!,
      splitType: 'subset',
      participants: [A!, B!, C!],
    })
    const byMember = Object.fromEntries(splits.map((s) => [s.memberId, s.shareCents]))
    expect(byMember[A!]).toBe(334)
    expect(byMember[B!]).toBe(333)
    expect(byMember[C!]).toBe(333)
    expect(byMember[D!]).toBeUndefined()
    expect(sum(splits)).toBe(1000)
  })
})

describe('computeSplits — exact', () => {
  it('uses the provided shares', () => {
    const splits = computeSplits({
      expenseId: 'e1',
      amountCents: 1000,
      paidBy: A!,
      splitType: 'exact',
      participants: [A!, B!],
      exactShares: { [A!]: 700, [B!]: 300 },
    })
    expect(sum(splits)).toBe(1000)
  })

  it('rejects shares that do not add up to the amount', () => {
    expect(() =>
      computeSplits({
        expenseId: 'e1',
        amountCents: 1000,
        paidBy: A!,
        splitType: 'exact',
        participants: [A!, B!],
        exactShares: { [A!]: 700, [B!]: 200 },
      }),
    ).toThrow(SplitError)
  })

  it('rejects missing or negative shares', () => {
    expect(() =>
      computeSplits({
        expenseId: 'e1',
        amountCents: 1000,
        paidBy: A!,
        splitType: 'exact',
        participants: [A!, B!],
        exactShares: { [A!]: 1000 },
      }),
    ).toThrow(SplitError)
  })
})

describe('computeSplits — invariant', () => {
  it('sum(shareCents) === amountCents for a sweep of amounts and group sizes', () => {
    for (let amount = 1; amount <= 500; amount++) {
      for (let n = 1; n <= 4; n++) {
        const participants = ALL.slice(0, n)
        const splits = computeSplits({
          expenseId: 'e1',
          amountCents: amount,
          paidBy: participants[0]!,
          splitType: 'equal',
          participants,
        })
        expect(sum(splits)).toBe(amount)
      }
    }
  })

  it('rejects non-positive and non-integer amounts', () => {
    for (const amount of [0, -100, 10.5]) {
      expect(() =>
        computeSplits({
          expenseId: 'e1',
          amountCents: amount,
          paidBy: A!,
          splitType: 'equal',
          participants: ALL,
        }),
      ).toThrow(SplitError)
    }
  })
})
