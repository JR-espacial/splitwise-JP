import type { Currency } from './types'

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  CZK: 'Kč',
  MXN: 'MX$',
  USD: 'US$',
  CHF: 'CHF',
}

/**
 * Convert original-currency cents to base-currency cents using the frozen
 * fx rate. The rate is not money, so float multiplication is fine; the
 * result is rounded back to integer cents.
 */
export function toBaseCents(amountCents: number, fxRateToBase: number): number {
  return Math.round(amountCents * fxRateToBase)
}

/** "1234" cents → "12,34 €". Sign-aware, thousands-separated. */
export function formatCents(cents: number, currency: Currency): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const units = Math.floor(abs / 100)
  const decimals = String(abs % 100).padStart(2, '0')
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const symbol = CURRENCY_SYMBOLS[currency]
  return currency === 'EUR' || currency === 'CZK'
    ? `${sign}${grouped},${decimals} ${symbol}`
    : `${sign}${symbol}${grouped},${decimals}`
}

/**
 * Parse a user-typed amount ("12", "12.5", "12,50") into integer cents
 * using string math only — no floats. Returns null when invalid.
 */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim().replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null
  const [unitsPart, decimalsPart = ''] = trimmed.split('.')
  const units = Number(unitsPart)
  const decimals = Number(decimalsPart.padEnd(2, '0'))
  const cents = units * 100 + decimals
  if (!Number.isSafeInteger(cents)) return null
  return cents
}
