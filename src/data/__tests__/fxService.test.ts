import { describe, expect, it } from 'vitest'
import { getAutoFxRate, invertRates } from '../fxService'

class FakeStorage {
  private data = new Map<string, string>()
  getItem = (key: string) => this.data.get(key) ?? null
  setItem = (key: string, value: string) => void this.data.set(key, value)
}
const okFetch = (rates: Record<string, number>, calls?: string[], base = 'MXN') =>
  (async (input: string | URL | Request) => {
    calls?.push(String(input))
    return new Response(JSON.stringify({ base, rates }))
  }) as typeof fetch
const failFetch = (async () => { throw new Error('offline') }) as typeof fetch

describe('invertRates', () => {
  it('converts MXN quotes into foreign→MXN, including HUF', () => {
    const rates = invertRates({ EUR: 0.05, CZK: 1.25, HUF: 20, CHF: 0.04, USD: 0.0625 }, 'MXN')
    expect(rates).toEqual({ MXN: 1, EUR: 20, CZK: 0.8, HUF: 0.05, CHF: 25, USD: 16 })
  })
  it('also supports a legacy EUR group without relabeling its rates', () => {
    expect(invertRates({ MXN: 20, CZK: 25 }, 'EUR')).toEqual({ EUR: 1, MXN: 0.05, CZK: 0.04 })
  })
  it('rejects nonfinite, zero and negative quotes and preserves base = 1', () => {
    expect(invertRates({ EUR: NaN, CZK: 0, CHF: Infinity, HUF: -1, MXN: 12 }, 'MXN')).toEqual({ MXN: 1 })
  })
})

describe('getAutoFxRate', () => {
  it('returns 1 for MXN without fetching', async () => {
    expect(await getAutoFxRate('MXN', 'MXN', { fetchFn: failFetch, storage: new FakeStorage() })).toBe(1)
  })
  it('requests MXN as base and HUF among symbols, and caches for 12 hours', async () => {
    const storage = new FakeStorage()
    const calls: string[] = []
    let now = 1_000_000
    const deps = { fetchFn: okFetch({ EUR: 0.05, HUF: 20 }, calls), storage, nowMs: () => now }
    expect(await getAutoFxRate('EUR', 'MXN', deps)).toBe(20)
    expect(new URL(calls[0]!).searchParams.get('base')).toBe('MXN')
    expect(new URL(calls[0]!).searchParams.get('symbols')?.split(',')).toContain('HUF')
    now += 60 * 60 * 1000
    expect(await getAutoFxRate('HUF', 'MXN', deps)).toBe(0.05)
    expect(calls).toHaveLength(1)
    now += 13 * 60 * 60 * 1000
    await getAutoFxRate('EUR', 'MXN', deps)
    expect(calls).toHaveLength(2)
  })
  it('uses stale rates offline and returns null without a usable cache', async () => {
    const storage = new FakeStorage()
    await getAutoFxRate('EUR', 'MXN', { fetchFn: okFetch({ EUR: 0.05 }), storage, nowMs: () => 0 })
    expect(await getAutoFxRate('EUR', 'MXN', { fetchFn: failFetch, storage, nowMs: () => 48 * 3600_000 })).toBe(20)
    expect(await getAutoFxRate('HUF', 'MXN', { fetchFn: failFetch, storage })).toBeNull()
  })
  it('never reuses a EUR cache for MXN, including the old unversioned cache', async () => {
    const storage = new FakeStorage()
    storage.setItem('roadtrip.fxRates', JSON.stringify({ fetchedAtMs: Date.now(), rates: { CHF: 1.07 } }))
    await getAutoFxRate('CHF', 'EUR', { fetchFn: okFetch({ CHF: 0.9 }, undefined, 'EUR'), storage })
    expect(await getAutoFxRate('CHF', 'MXN', { fetchFn: failFetch, storage })).toBeNull()
  })
  it('rejects a response with the wrong base', async () => {
    expect(await getAutoFxRate('CHF', 'MXN', { fetchFn: okFetch({ CHF: 0.9 }, undefined, 'EUR'), storage: new FakeStorage() })).toBeNull()
  })
  it('retains a valid network rate even if saving the cache fails', async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(await getAutoFxRate('EUR', 'MXN', { fetchFn: okFetch({ EUR: 0.05 }), storage })).toBe(20)
  })
  it('ignores malformed cached rates', async () => {
    const storage = new FakeStorage()
    storage.setItem('roadtrip.fxRates.v2.MXN', JSON.stringify({ fetchedAtMs: Date.now(), rates: { EUR: -2, HUF: '20' } }))
    expect(await getAutoFxRate('EUR', 'MXN', { fetchFn: failFetch, storage })).toBeNull()
  })
})
