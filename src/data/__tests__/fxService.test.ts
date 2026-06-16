import { describe, expect, it } from 'vitest'
import { getAutoFxRate, invertRates } from '../fxService'

class FakeStorage {
  private data = new Map<string, string>()
  getItem = (key: string) => this.data.get(key) ?? null
  setItem = (key: string, value: string) => void this.data.set(key, value)
}

const okFetch = (rates: Record<string, number>, calls?: { count: number }) =>
  (async () => {
    if (calls) calls.count += 1
    return new Response(JSON.stringify({ base: 'EUR', rates }))
  }) as typeof fetch

const failFetch = (async () => {
  throw new Error('offline')
}) as typeof fetch

describe('invertRates', () => {
  it('inverts EUR→foreign into foreign→EUR', () => {
    const rates = invertRates({ CZK: 24.7, USD: 1.087, CHF: 0.932, MXN: 19.95 })
    expect(rates.EUR).toBe(1)
    expect(rates.CZK).toBeCloseTo(0.04048583, 8)
    expect(rates.CHF).toBeCloseTo(1.07296137, 8)
  })

  it('skips missing or invalid currencies', () => {
    const rates = invertRates({ CZK: 0, USD: 1.1 })
    expect(rates.CZK).toBeUndefined()
    expect(rates.USD).toBeCloseTo(0.90909091, 8)
  })
})

describe('getAutoFxRate', () => {
  it('returns 1 for the base currency without fetching', async () => {
    expect(await getAutoFxRate('EUR', { fetchFn: failFetch, storage: new FakeStorage() })).toBe(1)
  })

  it('fetches, caches and serves from cache within the TTL', async () => {
    const storage = new FakeStorage()
    const calls = { count: 0 }
    let now = 1_000_000
    const deps = { fetchFn: okFetch({ CZK: 25 }, calls), storage, nowMs: () => now }

    expect(await getAutoFxRate('CZK', deps)).toBeCloseTo(0.04, 8)
    expect(calls.count).toBe(1)

    now += 60 * 60 * 1000 // 1h later: still fresh
    expect(await getAutoFxRate('CZK', deps)).toBeCloseTo(0.04, 8)
    expect(calls.count).toBe(1)

    now += 13 * 60 * 60 * 1000 // past the 12h TTL: refetches
    await getAutoFxRate('CZK', deps)
    expect(calls.count).toBe(2)
  })

  it('falls back to the stale cache when the API is unreachable', async () => {
    const storage = new FakeStorage()
    let now = 1_000_000
    await getAutoFxRate('USD', { fetchFn: okFetch({ USD: 1.25 }), storage, nowMs: () => now })

    now += 48 * 60 * 60 * 1000 // cache long stale, network down
    const rate = await getAutoFxRate('USD', { fetchFn: failFetch, storage, nowMs: () => now })
    expect(rate).toBeCloseTo(0.8, 8)
  })

  it('returns null when there is no cache and no network', async () => {
    expect(await getAutoFxRate('CZK', { fetchFn: failFetch, storage: new FakeStorage() })).toBeNull()
  })
})
