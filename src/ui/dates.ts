const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const

/** Local date as yyyy-mm-dd (what <input type="date"> expects). */
export function todayISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** "2026-06-11" → "11 jun". Appends the year when it isn't the current one. */
export function formatShortDate(isoDate: string): string {
  const [yearStr, monthStr, dayStr] = isoDate.slice(0, 10).split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const day = Number(dayStr)
  const month = MONTHS_ES[monthIndex] ?? ''
  const suffix = year === new Date().getFullYear() ? '' : ` ${year}`
  return `${day} ${month}${suffix}`
}
