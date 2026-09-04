import { CURRENCIES, type Currency } from '../domain/types'

/** Frankfurter v1: ECB reference rates, free and keyless. */
const API_URL = 'https://api.frankfurter.dev/v1/latest'
const CACHE_KEY = (base: Currency) => `roadtrip.fxRates.v2.${base}`
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

/** 1 unit of the original currency = N units of the group's base currency. */
export type RatesToBase = Partial<Record<Currency, number>>
interface CachedRates { fetchedAtMs: number; rates: RatesToBase }
export interface FxServiceDeps {
  fetchFn?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  nowMs?: () => number
}

function validRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function readCache(storage: FxServiceDeps['storage'], base: Currency): CachedRates | null {
  try {
    const raw = storage?.getItem(CACHE_KEY(base))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRates
    if (!Number.isFinite(parsed.fetchedAtMs) || !parsed.rates || typeof parsed.rates !== 'object') return null
    const rates: RatesToBase = { [base]: 1 }
    for (const currency of CURRENCIES) {
      if (currency !== base && validRate(parsed.rates[currency])) rates[currency] = parsed.rates[currency]
    }
    return { fetchedAtMs: parsed.fetchedAtMs, rates }
  } catch {
    return null
  }
}

/** API returns 1 base = N foreign; invert to 1 foreign = N base. */
export function invertRates(baseToForeign: Record<string, number>, base: Currency): RatesToBase {
  const rates: RatesToBase = { [base]: 1 }
  for (const currency of CURRENCIES) {
    const rate = baseToForeign[currency]
    if (currency !== base && validRate(rate)) {
      const inverted = Number((1 / rate).toFixed(8))
      if (validRate(inverted)) rates[currency] = inverted
    }
  }
  return rates
}

/** Cached reference rate; stale offline, null when unavailable. Never guesses a rate. */
export async function getAutoFxRate(
  currency: Currency,
  base: Currency,
  deps: FxServiceDeps = {},
): Promise<number | null> {
  if (currency === base) return 1
  const fetchFn = deps.fetchFn ?? fetch
  let storage = deps.storage
  try { storage ??= localStorage } catch { /* Rates still work without browser storage. */ }
  const nowMs = deps.nowMs ?? Date.now
  const cached = readCache(storage, base)
  if (cached && nowMs() - cached.fetchedAtMs < CACHE_TTL_MS && cached.rates[currency]) {
    return cached.rates[currency]!
  }

  try {
    const symbols = CURRENCIES.filter((c) => c !== base).join(',')
    const response = await fetchFn(`${API_URL}?base=${base}&symbols=${symbols}`)
    if (!response.ok) throw new Error(`fx api: ${response.status}`)
    const body = (await response.json()) as { base: string; rates: Record<string, number> }
    if (body.base !== base || !body.rates || typeof body.rates !== 'object') throw new Error('Invalid FX response')
    const rates = invertRates(body.rates, base)
    try {
      storage?.setItem(CACHE_KEY(base), JSON.stringify({ fetchedAtMs: nowMs(), rates } satisfies CachedRates))
    } catch { /* A storage failure must not discard a valid network result. */ }
    return rates[currency] ?? cached?.rates[currency] ?? null
  } catch {
    return cached?.rates[currency] ?? null
  }
}
