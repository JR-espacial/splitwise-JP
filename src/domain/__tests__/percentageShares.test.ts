import { describe, expect, it } from 'vitest'
import { percentageShares } from '../split'

describe('percentageShares', () => {
  it('preserves every cent with fractional percentages', () => {
    expect(percentageShares(100, { a: 3333, b: 3333, c: 3334 })).toEqual({ a: 33, b: 33, c: 34 })
    expect(percentageShares(1, { a: 5000, b: 5000 })).toEqual({ a: 1, b: 0 })
  })
  it('rejects incomplete and invalid distributions', () => {
    for (const weights of [{ a: 9000 }, { a: -100, b: 10100 }, { a: 5000.5, b: 4999.5 }] as Record<string, number>[]) {
      expect(() => percentageShares(3600, weights)).toThrow()
    }
  })
  it('handles large safe integer amounts without losing cents', () => {
    const shares = percentageShares(Number.MAX_SAFE_INTEGER, { a: 5000, b: 5000 })
    expect(shares.a! + shares.b!).toBe(Number.MAX_SAFE_INTEGER)
  })
})
