import type { Currency } from '../domain/types'

/** Rough mid-2026 defaults; always editable in the form before saving. */
const FALLBACK_RATES_TO_EUR: Record<Currency, number> = {
  EUR: 1,
  CZK: 0.04,
  MXN: 0.05,
  USD: 0.92,
  CHF: 1.07,
}

const RATE_KEY = (currency: Currency) => `roadtrip.fxRate.${currency}`
const LAST_CURRENCY_KEY = 'roadtrip.lastCurrency'

/** Last rate the user typed for this currency, falling back to a rough default. */
export function getDefaultFxRate(currency: Currency): number {
  const stored = localStorage.getItem(RATE_KEY(currency))
  const parsed = stored === null ? NaN : Number(stored)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_RATES_TO_EUR[currency]
}

export function rememberFxRate(currency: Currency, rate: number): void {
  localStorage.setItem(RATE_KEY(currency), String(rate))
}

export function getLastCurrency(): Currency | null {
  return localStorage.getItem(LAST_CURRENCY_KEY) as Currency | null
}

export function rememberLastCurrency(currency: Currency): void {
  localStorage.setItem(LAST_CURRENCY_KEY, currency)
}
