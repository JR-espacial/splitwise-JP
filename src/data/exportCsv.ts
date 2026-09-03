import { CATEGORY_LABELS, expenseCategory } from '../domain/categories'
import type { LedgerSnapshot } from './repository'

function csvCell(value: string | number): string {
  // Prevent spreadsheet applications from interpreting user-entered text as formulas.
  const raw = String(value)
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function amount(cents: number): string {
  return `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`
}

export function buildLedgerCsv(snapshot: LedgerSnapshot): string {
  const memberName = new Map(snapshot.members.map((member) => [member.id, member.name]))
  const header = [
    'Tipo', 'Fecha', 'Descripción', 'Categoría', 'Monto', 'Moneda', 'Pagó/De',
    'Para', 'Reparto', 'Comprobante', 'Creado por', 'Actualizado por', 'Último cambio',
  ]
  const rows: Array<Array<string | number>> = [header]

  for (const expense of snapshot.expenses.filter((item) => item.deletedAt === null)) {
    const splitText = snapshot.splits
      .filter((split) => split.expenseId === expense.id)
      .map((split) => `${memberName.get(split.memberId) ?? '—'}: ${amount(split.shareCents)} ${expense.currency}`)
      .join(' | ')
    rows.push([
      'Gasto', expense.expenseDate, expense.description,
      CATEGORY_LABELS[expenseCategory(expense.category)], amount(expense.amountCents),
      expense.currency, memberName.get(expense.paidBy) ?? '—', '', splitText,
      expense.receiptDataUrl ? 'Sí' : 'No',
      expense.createdBy ? memberName.get(expense.createdBy) ?? '—' : '—',
      expense.updatedBy ? memberName.get(expense.updatedBy) ?? '—' : '—', expense.updatedAt,
    ])
  }

  for (const settlement of snapshot.settlements.filter((item) => item.deletedAt === null)) {
    rows.push([
      'Pago', settlement.settlementDate ?? settlement.createdAt.slice(0, 10), 'Liquidación', '',
      amount(settlement.amountCents), snapshot.group.baseCurrency,
      memberName.get(settlement.fromMember) ?? '—', memberName.get(settlement.toMember) ?? '—',
      '', 'No', settlement.createdBy ? memberName.get(settlement.createdBy) ?? '—' : '—',
      settlement.updatedBy ? memberName.get(settlement.updatedBy) ?? '—' : '—', settlement.updatedAt,
    ])
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function downloadLedgerCsv(snapshot: LedgerSnapshot): void {
  const blob = new Blob([buildLedgerCsv(snapshot)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gastos-${snapshot.group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
