import { CURRENCIES, type Currency } from '../domain/types'

// Include the base so previous EUR rates are never reused as MXN rates.
const RATE_KEY = (currency: Currency, base: Currency) => `roadtrip.fxRate.v2.${base}.${currency}`
const LAST_CURRENCY_KEY = (base: Currency) => `roadtrip.lastCurrency.v2.${base}`

export function getDefaultFxRate(currency: Currency, base: Currency): number | null {
  if (currency === base) return 1
  try {
    const parsed = Number(localStorage.getItem(RATE_KEY(currency, base)))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch { return null }
}

export function rememberFxRate(currency: Currency, base: Currency, rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) return
  try { localStorage.setItem(RATE_KEY(currency, base), String(rate)) } catch { /* Optional preference. */ }
}

export function getLastCurrency(base: Currency): Currency | null {
  try {
    const value = localStorage.getItem(LAST_CURRENCY_KEY(base))
    return CURRENCIES.find((currency) => currency === value) ?? null
  } catch { return null }
}

export function rememberLastCurrency(currency: Currency, base: Currency): void {
  try { localStorage.setItem(LAST_CURRENCY_KEY(base), currency) } catch { /* Optional preference. */ }
}
