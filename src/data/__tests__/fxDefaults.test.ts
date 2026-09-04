import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultFxRate, getLastCurrency, rememberFxRate, rememberLastCurrency } from '../fxDefaults'

describe('FX preferences', () => {
  let data: Map<string, string>
  beforeEach(() => {
    data = new Map()
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('never treats an old EUR default as an MXN rate', () => {
    data.set('roadtrip.fxRate.CHF', '1.07')
    expect(getDefaultFxRate('CHF', 'MXN')).toBeNull()
    expect(getDefaultFxRate('MXN', 'MXN')).toBe(1)
    rememberFxRate('CHF', 'MXN', 22)
    expect(getDefaultFxRate('CHF', 'MXN')).toBe(22)
    expect(getDefaultFxRate('CHF', 'EUR')).toBeNull()
  })
  it('remembers HUF per base and ignores invalid stored currencies', () => {
    rememberLastCurrency('HUF', 'MXN')
    expect(getLastCurrency('MXN')).toBe('HUF')
    expect(getLastCurrency('EUR')).toBeNull()
    data.set('roadtrip.lastCurrency.v2.MXN', 'invalid')
    expect(getLastCurrency('MXN')).toBeNull()
  })
  it('storage failures do not block entering an expense', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(getDefaultFxRate('EUR', 'MXN')).toBeNull()
    expect(() => rememberFxRate('EUR', 'MXN', 20)).not.toThrow()
    expect(() => rememberLastCurrency('HUF', 'MXN')).not.toThrow()
  })
})
