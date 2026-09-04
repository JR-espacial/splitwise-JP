import type { OutboxEntry } from './db'
import type { Group } from './rows'

// The exact, one-time conversion applied by migration 0006 to this test group.
// Never use a current market rate to reinterpret a previously captured entry.
const MIGRATED_GROUP_ID = '11111111-1111-4111-8111-111111111111'
const EUR_TO_MXN = 19.7593

export function rebasePending(entry: OutboxEntry, group: Group): OutboxEntry {
  const entity = entry.kind === 'expense' ? entry.expense : entry.settlement
  const previousBase = entity.baseCurrency ?? 'EUR'
  if (previousBase === group.baseCurrency) return entry
  if (group.id !== MIGRATED_GROUP_ID || entity.groupId !== group.id ||
    previousBase !== 'EUR' || group.baseCurrency !== 'MXN') {
    throw new Error('Hay cambios pendientes en otra moneda base que requieren revisión.')
  }

  if (entry.kind === 'expense') {
    const fxRateToBase = entry.expense.currency === 'MXN'
      ? 1
      : Number((entry.expense.fxRateToBase * EUR_TO_MXN).toFixed(8))
    if (!Number.isFinite(fxRateToBase) || fxRateToBase <= 0) {
      throw new Error('No se pudo convertir el tipo de cambio del gasto pendiente.')
    }
    return { ...entry, expense: { ...entry.expense, baseCurrency: 'MXN', fxRateToBase } }
  }

  // Exact integer arithmetic: the migration rate is 197593 / 10000.
  // Match Postgres round(numeric), including half-cent ties.
  const amount = entry.settlement.amountCents
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('El pago pendiente tiene un importe inválido.')
  }
  const amountCents = Number((BigInt(amount) * 197593n + 5000n) / 10000n)
  if (!Number.isSafeInteger(amountCents)) throw new Error('El pago convertido excede el importe permitido.')
  return { ...entry, settlement: { ...entry.settlement, baseCurrency: 'MXN', amountCents } }
}
