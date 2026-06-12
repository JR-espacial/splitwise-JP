import { CURRENCIES, type Currency } from '../domain/types'

/** Frankfurter (ECB daily reference rates), free and keyless. */
const API_URL = 'https://api.frankfurter.dev/v1/latest'
const CACHE_KEY = 'roadtrip.fxRates'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

/** Rates as fx_rate_to_base: 1 unit of currency = N EUR. */
export type RatesToBase = Partial<Record<Currency, number>>

interface CachedRates {
  fetchedAtMs: number
  rates: RatesToBase
}

export interface FxServiceDeps {
  fetchFn?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  nowMs?: () => number
}

function readCache(storage: Pick<Storage, 'getItem' | 'setItem'>): CachedRates | null {
  try {
    const raw = storage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRates
    if (typeof parsed.fetchedAtMs !== 'number' || typeof parsed.rates !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

/** API returns 1 EUR = N foreign; we store the inverse (1 foreign = N EUR). */
export function invertRates(eurToForeign: Record<string, number>): RatesToBase {
  const rates: RatesToBase = { EUR: 1 }
  for (const currency of CURRENCIES) {
    const rate = eurToForeign[currency]
    if (typeof rate === 'number' && rate > 0) {
      rates[currency] = Number((1 / rate).toFixed(8))
    }
  }
  return rates
}

/**
 * Today's rate to EUR for a currency, from cache when fresh, otherwise from
 * the API; falls back to the stale cache offline and to null when nothing
 * is available (the form then keeps its manual default).
 */
export async function getAutoFxRate(
  currency: Currency,
  deps: FxServiceDeps = {},
): Promise<number | null> {
  if (currency === 'EUR') return 1
  const fetchFn = deps.fetchFn ?? fetch
  const storage = deps.storage ?? localStorage
  const nowMs = deps.nowMs ?? Date.now

  const cached = readCache(storage)
  if (cached && nowMs() - cached.fetchedAtMs < CACHE_TTL_MS) {
    return cached.rates[currency] ?? null
  }

  try {
    const symbols = CURRENCIES.filter((c) => c !== 'EUR').join(',')
    const response = await fetchFn(`${API_URL}?base=EUR&symbols=${symbols}`)
    if (!response.ok) throw new Error(`fx api: ${response.status}`)
    const body = (await response.json()) as { rates: Record<string, number> }
    const rates = invertRates(body.rates)
    storage.setItem(CACHE_KEY, JSON.stringify({ fetchedAtMs: nowMs(), rates } satisfies CachedRates))
    return rates[currency] ?? null
  } catch {
    return cached?.rates[currency] ?? null
  }
}
