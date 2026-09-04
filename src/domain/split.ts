import type { ExpenseSplit, SplitType } from './types'

export interface SplitInput {
  expenseId: string
  amountCents: number
  paidBy: string
  splitType: SplitType
  /** Participating member ids, in stable group order. */
  participants: string[]
  /** Required when splitType === 'exact': cents per participant. */
  exactShares?: Record<string, number>
}

export class SplitError extends Error {}

/**
 * Compute integer-cent shares for an expense.
 *
 * Rounding rule: equal/subset shares are floor(amount / n); the remainder
 * goes to the payer when they participate, otherwise to the participant
 * with the largest share (first in group order on ties).
 *
 * Invariant: sum(shareCents) === amountCents, enforced before returning.
 */
export function computeSplits(input: SplitInput): ExpenseSplit[] {
  const { expenseId, amountCents, paidBy, splitType, participants } = input
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new SplitError('amountCents must be a positive integer')
  }
  if (participants.length === 0) {
    throw new SplitError('at least one participant is required')
  }
  if (new Set(participants).size !== participants.length) {
    throw new SplitError('participants must be unique')
  }

  let splits: ExpenseSplit[]
  if (splitType === 'exact') {
    const shares = input.exactShares
    if (!shares) throw new SplitError('exact split requires exactShares')
    splits = participants.map((memberId) => {
      const shareCents = shares[memberId]
      if (shareCents === undefined || !Number.isSafeInteger(shareCents) || shareCents < 0) {
        throw new SplitError(`invalid exact share for member ${memberId}`)
      }
      return { expenseId, memberId, shareCents }
    })
  } else {
    const n = participants.length
    const base = Math.floor(amountCents / n)
    const remainder = amountCents - base * n
    const remainderTo = participants.includes(paidBy) ? paidBy : participants[0]!
    splits = participants.map((memberId) => ({
      expenseId,
      memberId,
      shareCents: base + (memberId === remainderTo ? remainder : 0),
    }))
  }

  assertSplitsMatchAmount(amountCents, splits)
  return splits
}

export function assertSplitsMatchAmount(amountCents: number, splits: ExpenseSplit[]): void {
  const total = splits.reduce((sum, s) => sum + s.shareCents, 0)
  if (total !== amountCents) {
    throw new SplitError(`split invariant violated: shares sum to ${total}, expected ${amountCents}`)
  }
}

/** Convert hundredths of a percent to cents, distributing rounding by largest remainder. */
export function percentageShares(amountCents: number, weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || entries.length === 0 ||
      entries.some(([, weight]) => !Number.isInteger(weight) || weight < 0 || weight > 10000) ||
      entries.reduce((sum, [, weight]) => sum + weight, 0) !== 10000) {
    throw new SplitError('Los porcentajes deben sumar 100%.')
  }
  const shares = entries.map(([id, weight]) => {
    const product = BigInt(amountCents) * BigInt(weight)
    return { id, cents: Number(product / 10000n), remainder: Number(product % 10000n) }
  })
  const remaining = amountCents - shares.reduce((sum, share) => sum + share.cents, 0)
  const ranked = [...shares].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < remaining; i++) ranked[i]!.cents++
  return Object.fromEntries(shares.map(({ id, cents }) => [id, cents]))
}
