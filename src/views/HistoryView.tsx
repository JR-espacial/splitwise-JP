import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { downloadLedgerCsv } from '../data/exportCsv'
import { CATEGORY_ICONS, CATEGORY_LABELS, expenseCategory } from '../domain/categories'
import { formatCents, toBaseCents } from '../domain/money'
import { computeTripTotals } from '../domain/totals'
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type Settlement } from '../domain/types'
import { DesignIcon } from '../ui/DesignIcon'
import { MemberAvatar } from '../ui/MemberAvatar'
import { formatShortDate } from '../ui/dates'
import { useIdentity } from '../ui/identityContext'

type TypeFilter = 'all' | 'expense' | 'settlement'

const filterChip = (active: boolean) =>
  `min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold transition ${
    active
      ? 'border-accent-600 bg-accent-600 text-on-accent'
      : 'border-slate-300 bg-surface text-slate-700 active:bg-slate-100'
  }`

type LedgerEntry =
  | { kind: 'expense'; date: string; createdAt: string; expense: Expense }
  | { kind: 'settlement'; date: string; createdAt: string; settlement: Settlement }

type UndoTarget =
  | { kind: 'expense'; expense: Expense }
  | { kind: 'settlement'; settlement: Settlement }

const UNDO_MS = 5000

export function HistoryView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const navigate = useNavigate()
  const { currentMemberId } = useIdentity()
  const { group, members, expenses, splits, settlements } = snapshot
  const base = group.baseCurrency
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '—'

  const [payerFilter, setPayerFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null)
  const [query, setQuery] = useState('')
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }, [])

  const showUndo = (target: UndoTarget) => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoTarget(target)
    undoTimer.current = setTimeout(() => setUndoTarget(null), UNDO_MS)
  }

  const deleteExpense = (expense: Expense) => {
    const now = new Date().toISOString()
    const expenseSplits = splits.filter((s) => s.expenseId === expense.id)
    const changeLog = [...(expense.changeLog ?? []), { id: crypto.randomUUID(), memberId: currentMemberId, action: 'deleted' as const, at: now }]
    const deletedExpense = { ...expense, deletedAt: now, updatedAt: now, updatedBy: currentMemberId, changeLog }
    void ledgerStore.saveExpense(deletedExpense, expenseSplits)
    showUndo({ kind: 'expense', expense: deletedExpense })
  }

  const deleteSettlement = (settlement: Settlement) => {
    const now = new Date().toISOString()
    const changeLog = [...(settlement.changeLog ?? []), { id: crypto.randomUUID(), memberId: currentMemberId, action: 'deleted' as const, at: now }]
    const deletedSettlement = { ...settlement, deletedAt: now, updatedAt: now, updatedBy: currentMemberId, changeLog }
    void ledgerStore.saveSettlement(deletedSettlement)
    showUndo({ kind: 'settlement', settlement: deletedSettlement })
  }

  const undo = () => {
    if (!undoTarget) return
    const now = new Date().toISOString()
    if (undoTarget.kind === 'expense') {
      const { expense } = undoTarget
      const expenseSplits = splits.filter((s) => s.expenseId === expense.id)
      const changeLog = [...(expense.changeLog ?? []), { id: crypto.randomUUID(), memberId: currentMemberId, action: 'restored' as const, at: now }]
      void ledgerStore.saveExpense({ ...expense, deletedAt: null, updatedAt: now, updatedBy: currentMemberId, changeLog }, expenseSplits)
    } else {
      const settlement = undoTarget.settlement
      const changeLog = [...(settlement.changeLog ?? []), { id: crypto.randomUUID(), memberId: currentMemberId, action: 'restored' as const, at: now }]
      void ledgerStore.saveSettlement({ ...settlement, deletedAt: null, updatedAt: now, updatedBy: currentMemberId, changeLog })
    }
    setUndoTarget(null)
  }

  const visibleExpenses = expenses.filter(
    (e) =>
      e.deletedAt === null &&
      (payerFilter === null || e.paidBy === payerFilter) &&
      typeFilter !== 'settlement' &&
      (categoryFilter === null || expenseCategory(e.category) === categoryFilter) &&
      (query.trim() === '' || e.description.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))),
  )
  const visibleSettlements = settlements.filter(
    (s) =>
      s.deletedAt === null &&
      (payerFilter === null || s.fromMember === payerFilter) &&
      typeFilter !== 'expense',
  )

  const entries: LedgerEntry[] = [
    ...visibleExpenses.map((expense): LedgerEntry => ({
      kind: 'expense',
      date: expense.expenseDate,
      createdAt: expense.createdAt,
      expense,
    })),
    ...visibleSettlements.map((settlement): LedgerEntry => ({
      kind: 'settlement',
      date: settlement.settlementDate ?? settlement.createdAt.slice(0, 10),
      createdAt: settlement.createdAt,
      settlement,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  const totals = computeTripTotals(visibleExpenses, splits)

  return (
    <div className="history-view animate-rise flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold tracking-tight text-slate-900">Historial</h2><p className="text-xs text-slate-500">Movimientos registrados</p></div>
        <button type="button" onClick={() => downloadLedgerCsv(snapshot)} className="min-h-11 rounded-xl bg-accent-50 px-3 text-xs font-semibold text-accent-ink"><DesignIcon name="export" size={14} /> Exportar</button>
      </div>

      <label className="relative">
        <span className="sr-only">Buscar gastos</span>
        <span aria-hidden className="absolute left-3 top-3 text-slate-400">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por descripción…"
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-surface pl-9 pr-3 text-slate-900"
        />
      </label>

      <div className="flex gap-2" role="group" aria-label="Filtrar por tipo">
        {(
          [
            ['all', 'Todos'],
            ['expense', 'Gastos'],
            ['settlement', 'Liquidaciones'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTypeFilter(value)}
            className={filterChip(typeFilter === value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por persona">
        <button type="button" onClick={() => setPayerFilter(null)} className={filterChip(payerFilter === null)}>
          Viajeros: Todos
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setPayerFilter(payerFilter === m.id ? null : m.id)}
            className={filterChip(payerFilter === m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>
      {typeFilter !== 'settlement' && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por categoría">
          <button type="button" onClick={() => setCategoryFilter(null)} className={filterChip(categoryFilter === null)}>Categoría: Todas</button>
          {EXPENSE_CATEGORIES.map((category) => (
            <button key={category} type="button" onClick={() => setCategoryFilter(categoryFilter === category ? null : category)} className={filterChip(categoryFilter === category)}>
              {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      )}

      {typeFilter !== 'settlement' && (
        <div className="history-total flex items-center justify-between rounded-2xl px-4 py-3 shadow-sm">
          <span className="text-sm text-slate-600">
            {payerFilter === null
              ? 'Total del viaje'
              : `Pagado por ${memberName(payerFilter)}`}
            <span className="block text-xs text-slate-400">
              {totals.expenseCount} {totals.expenseCount === 1 ? 'gasto' : 'gastos'}
            </span>
          </span>
          <span className="text-lg font-bold tabular-nums text-slate-900">
            {formatCents(totals.totalBaseCents, base)}
          </span>
        </div>
      )}

      {entries.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-surface px-4 py-10 text-center text-slate-500">
          Aún no hay movimientos.
        </p>
      )}

      <ul className="history-list flex flex-col gap-2">
        {entries.map((entry, index) => <Fragment key={entry.kind === 'expense' ? entry.expense.id : entry.settlement.id}>
          {(index === 0 || entries[index - 1]?.date !== entry.date) && <li className="history-date">{formatShortDate(entry.date)}</li>}
          {entry.kind === 'expense' ? (
            <li key={entry.expense.id}>
              <div className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
                <button
                  type="button"
                  onClick={() => navigate(`/expense/${entry.expense.id}`)}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-slate-50"
                >
                  <span className="history-category"><DesignIcon name={expenseCategory(entry.expense.category)} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900" title={entry.expense.description}>
                      {entry.expense.description}
                    </p>
                    <p className="truncate text-sm text-slate-500">{entry.expense.paidBy === currentMemberId ? 'Pagaste tú' : `Pagó ${memberName(entry.expense.paidBy)}`}</p>
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-right tabular-nums">
                    <p className="font-bold text-slate-900">
                      {formatCents(entry.expense.amountCents, entry.expense.currency)}
                    </p>
                    {entry.expense.currency !== base && (
                      <p className="text-sm text-slate-500">
                        ≈{' '}
                        {formatCents(
                          toBaseCents(entry.expense.amountCents, entry.expense.fxRateToBase),
                          base,
                        )}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteExpense(entry.expense)}
                  aria-label={`Borrar gasto ${entry.expense.description}`}
                  className="flex w-12 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 active:bg-danger-soft active:text-danger"
                >
                  <DesignIcon name="delete" size={14} />
                </button>
              </div>
            </li>
          ) : (
            <li key={entry.settlement.id}>
              <div className="flex items-stretch overflow-hidden rounded-2xl border border-accent-200 bg-accent-50">
                <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2">
                  {members.find((member) => member.id === entry.settlement.fromMember) && <MemberAvatar member={members.find((member) => member.id === entry.settlement.fromMember)!} size={36} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {memberName(entry.settlement.fromMember)} pagó a{' '}
                      {memberName(entry.settlement.toMember)}
                    </p>
                    <p className="text-sm text-accent-ink">{formatShortDate(entry.date)}</p>
                    <p className="truncate text-xs text-accent-ink/80">
                      Registró {entry.settlement.createdBy ? memberName(entry.settlement.createdBy) : 'un integrante'}
                    </p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap font-bold tabular-nums text-success">
                    {formatCents(entry.settlement.amountCents, base)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSettlement(entry.settlement)}
                  aria-label="Borrar pago"
                  className="flex w-12 shrink-0 items-center justify-center border-l border-accent-100 text-accent-ink active:bg-danger-soft active:text-danger"
                >
                  <DesignIcon name="delete" size={14} />
                </button>
              </div>
            </li>
          )}
        </Fragment>)}
      </ul>

      {undoTarget && (
        <div className="animate-rise fixed inset-x-0 bottom-24 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-toast px-4 py-3 text-white shadow-xl">
          <span className="text-sm">
            {undoTarget.kind === 'expense' ? 'Gasto borrado' : 'Pago borrado'}
          </span>
          <button
            type="button"
            onClick={undo}
            className="min-h-11 rounded-xl px-3 font-bold text-white active:bg-white/10"
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
