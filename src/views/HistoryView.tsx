import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { formatCents, toBaseCents } from '../domain/money'
import type { Expense, Settlement } from '../domain/types'
import { formatShortDate } from '../ui/dates'

type LedgerEntry =
  | { kind: 'expense'; date: string; createdAt: string; expense: Expense }
  | { kind: 'settlement'; date: string; createdAt: string; settlement: Settlement }

type UndoTarget =
  | { kind: 'expense'; expense: Expense }
  | { kind: 'settlement'; settlement: Settlement }

const UNDO_MS = 5000

export function HistoryView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const navigate = useNavigate()
  const { group, members, expenses, splits, settlements } = snapshot
  const base = group.baseCurrency
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '—'

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
    void ledgerStore.saveExpense({ ...expense, deletedAt: now, updatedAt: now }, expenseSplits)
    showUndo({ kind: 'expense', expense })
  }

  const deleteSettlement = (settlement: Settlement) => {
    const now = new Date().toISOString()
    void ledgerStore.saveSettlement({ ...settlement, deletedAt: now, updatedAt: now })
    showUndo({ kind: 'settlement', settlement })
  }

  const undo = () => {
    if (!undoTarget) return
    const now = new Date().toISOString()
    if (undoTarget.kind === 'expense') {
      const { expense } = undoTarget
      const expenseSplits = splits.filter((s) => s.expenseId === expense.id)
      void ledgerStore.saveExpense({ ...expense, deletedAt: null, updatedAt: now }, expenseSplits)
    } else {
      void ledgerStore.saveSettlement({ ...undoTarget.settlement, deletedAt: null, updatedAt: now })
    }
    setUndoTarget(null)
  }

  const entries: LedgerEntry[] = [
    ...expenses
      .filter((e) => e.deletedAt === null)
      .map((expense): LedgerEntry => ({
        kind: 'expense',
        date: expense.expenseDate,
        createdAt: expense.createdAt,
        expense,
      })),
    ...settlements
      .filter((s) => s.deletedAt === null)
      .map((settlement): LedgerEntry => ({
        kind: 'settlement',
        date: settlement.createdAt.slice(0, 10),
        createdAt: settlement.createdAt,
        settlement,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Historial</h2>

      {entries.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500">
          Aún no hay movimientos.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry) =>
          entry.kind === 'expense' ? (
            <li key={entry.expense.id}>
              <div className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => navigate(`/expense/${entry.expense.id}`)}
                  className="flex min-h-16 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {entry.expense.description}
                    </p>
                    <p className="text-sm text-slate-500">
                      {memberName(entry.expense.paidBy)} pagó · {formatShortDate(entry.date)}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
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
                  className="flex w-12 items-center justify-center border-l border-slate-100 text-slate-400 active:bg-red-50 active:text-red-600"
                >
                  ✕
                </button>
              </div>
            </li>
          ) : (
            <li key={entry.settlement.id}>
              <div className="flex items-stretch overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
                <div className="flex min-h-14 flex-1 items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900">
                      {memberName(entry.settlement.fromMember)} pagó a{' '}
                      {memberName(entry.settlement.toMember)}
                    </p>
                    <p className="text-sm text-emerald-700">{formatShortDate(entry.date)}</p>
                  </div>
                  <p className="font-bold tabular-nums text-emerald-900">
                    {formatCents(entry.settlement.amountCents, base)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSettlement(entry.settlement)}
                  aria-label="Borrar pago"
                  className="flex w-12 items-center justify-center border-l border-emerald-100 text-emerald-400 active:bg-red-50 active:text-red-600"
                >
                  ✕
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {undoTarget && (
        <div className="fixed inset-x-0 bottom-24 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
          <span className="text-sm">
            {undoTarget.kind === 'expense' ? 'Gasto borrado' : 'Pago borrado'}
          </span>
          <button
            type="button"
            onClick={undo}
            className="min-h-11 rounded-xl px-3 font-bold text-emerald-400 active:bg-slate-800"
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
