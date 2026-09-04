import { describe, expect, it } from 'vitest'
import { formatCents, parseAmountToCents, toBaseCents } from '../money'

describe('parseAmountToCents', () => {
  it('parses plain integers', () => {
    expect(parseAmountToCents('12')).toBe(1200)
    expect(parseAmountToCents('0')).toBe(0)
  })

  it('parses dot and comma decimals', () => {
    expect(parseAmountToCents('12.34')).toBe(1234)
    expect(parseAmountToCents('12,34')).toBe(1234)
    expect(parseAmountToCents('12.5')).toBe(1250)
    expect(parseAmountToCents('0.07')).toBe(7)
  })

  it('never loses precision on float-hostile inputs', () => {
    // 19.99 * 100 === 1998.9999... with floats
    expect(parseAmountToCents('19.99')).toBe(1999)
    expect(parseAmountToCents('0.29')).toBe(29)
    expect(parseAmountToCents('1.13')).toBe(113)
  })

  it('rejects invalid input', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
    expect(parseAmountToCents('1.234')).toBeNull()
    expect(parseAmountToCents('-5')).toBeNull()
    expect(parseAmountToCents('1.2.3')).toBeNull()
  })
})

describe('toBaseCents', () => {
  it('is identity at rate 1', () => {
    expect(toBaseCents(1234, 1)).toBe(1234)
  })

  it('rounds to nearest cent', () => {
    // 250 CZK at 0.0405 EUR/CZK = 1012.5 → 1013
    expect(toBaseCents(25000, 0.0405)).toBe(1013)
    expect(toBaseCents(100, 0.054)).toBe(5)
  })
})

describe('formatCents', () => {
  it('formats EUR with trailing symbol and comma decimals', () => {
    expect(formatCents(123456, 'EUR')).toBe('1.234,56 €')
  })

  it('formats negative amounts', () => {
    expect(formatCents(-501, 'EUR')).toBe('-5,01 €')
  })

  it('formats leading-symbol currencies', () => {
    expect(formatCents(1999, 'USD')).toBe('US$19,99')
    expect(formatCents(1999, 'MXN')).toBe('MX$19.99')
  })

  it('formats Mexican pesos with local separators and HUF with its symbol', () => {
    expect(formatCents(123456, 'MXN')).toBe('MX$1,234.56')
    expect(formatCents(-501, 'MXN')).toBe('-MX$5.01')
    expect(formatCents(123456, 'HUF')).toBe('1.234,56 Ft')
  })

  it('pads decimals', () => {
    expect(formatCents(5, 'EUR')).toBe('0,05 €')
  })
})
