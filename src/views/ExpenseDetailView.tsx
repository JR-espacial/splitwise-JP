import { Link, useNavigate, useParams } from 'react-router-dom'
import type { LedgerSnapshot } from '../data/repository'
import { CATEGORY_ICONS, CATEGORY_LABELS, expenseCategory } from '../domain/categories'
import { formatCents, toBaseCents } from '../domain/money'
import { formatShortDate } from '../ui/dates'
import { MemberAvatar } from '../ui/MemberAvatar'

const ACTION_LABELS = {
  created: 'Creó el gasto',
  updated: 'Editó el gasto',
  deleted: 'Eliminó el gasto',
  restored: 'Restauró el gasto',
} as const

export function ExpenseDetailView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const expense = snapshot.expenses.find((item) => item.id === id && item.deletedAt === null)
  if (!expense) {
    return <p className="py-10 text-center text-slate-500">Gasto no encontrado.</p>
  }

  const memberById = new Map(snapshot.members.map((member) => [member.id, member]))
  const payer = memberById.get(expense.paidBy)
  const creator = expense.createdBy ? memberById.get(expense.createdBy) : null
  const updater = expense.updatedBy ? memberById.get(expense.updatedBy) : null
  const category = expenseCategory(expense.category)
  const expenseSplits = snapshot.splits.filter((split) => split.expenseId === expense.id)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 px-1 font-semibold text-slate-600">
          ← Volver
        </button>
        <Link
          to={`/expense/${expense.id}/edit`}
          className="flex min-h-11 items-center rounded-xl bg-accent-600 px-4 font-bold text-on-accent active:bg-accent-700"
        >
          Editar
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-surface p-5 text-center shadow-sm">
        <div className="text-3xl" aria-hidden>{CATEGORY_ICONS[category]}</div>
        <p className="mt-1 text-sm font-semibold text-slate-500">{CATEGORY_LABELS[category]}</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900">{expense.description}</h2>
        <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">
          {formatCents(expense.amountCents, expense.currency)}
        </p>
        {expense.currency !== snapshot.group.baseCurrency && (
          <p className="text-sm text-slate-500">
            ≈ {formatCents(toBaseCents(expense.amountCents, expense.fxRateToBase), snapshot.group.baseCurrency)}
          </p>
        )}
        <p className="mt-3 text-sm text-slate-600">
          {payer?.name ?? '—'} pagó · {formatShortDate(expense.expenseDate)}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Reparto</h3>
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
          {expenseSplits.map((split) => {
            const member = memberById.get(split.memberId)
            if (!member) return null
            return (
              <li key={split.memberId} className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 last:border-b-0">
                <MemberAvatar member={member} size={34} />
                <span className="flex-1 font-semibold text-slate-900">{member.name}</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatCents(split.shareCents, expense.currency)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {expense.receiptDataUrl && (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Comprobante</h3>
          <a href={expense.receiptDataUrl} target="_blank" rel="noreferrer">
            <img
              src={expense.receiptDataUrl}
              alt="Comprobante del gasto"
              className="max-h-[32rem] w-full rounded-2xl border border-slate-200 bg-surface object-contain shadow-sm"
            />
          </a>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-slate-600">
        <p>Creado por <span className="font-semibold text-slate-900">{creator?.name ?? 'Integrante del grupo'}</span>.</p>
        <p>
          Último cambio por <span className="font-semibold text-slate-900">{updater?.name ?? creator?.name ?? 'Integrante del grupo'}</span>
          {' · '}{new Date(expense.updatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </section>

      {(expense.changeLog?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Actividad</h3>
          <ol className="overflow-hidden rounded-2xl border border-slate-200 bg-surface">
            {[...(expense.changeLog ?? [])].reverse().map((change) => (
              <li key={change.id} className="border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                <p className="font-semibold text-slate-900">{memberById.get(change.memberId)?.name ?? 'Integrante'} · {ACTION_LABELS[change.action]}</p>
                <p className="text-slate-500">{new Date(change.at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
