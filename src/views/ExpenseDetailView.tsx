import { Link, useNavigate, useParams } from 'react-router-dom'
import type { LedgerSnapshot } from '../data/repository'
import { CATEGORY_LABELS, expenseCategory } from '../domain/categories'
import { formatCents, toBaseCents } from '../domain/money'
import { formatShortDate } from '../ui/dates'
import { ConfirmButton } from '../ui/ConfirmButton'
import { ledgerStore } from '../data/store'
import { useIdentity } from '../ui/identityContext'
import { DesignIcon } from '../ui/DesignIcon'
import { MemberAvatar } from '../ui/MemberAvatar'

const ACTION_LABELS = {
  created: 'Creó el gasto',
  updated: 'Editó el gasto',
  deleted: 'Eliminó el gasto',
  restored: 'Restauró el gasto',
} as const

export function ExpenseDetailView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const { currentMemberId } = useIdentity()
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
    <div className="detail-view flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/history')} className="min-h-11 px-1 font-semibold text-slate-600">
          <DesignIcon name="back" size={16} /> Volver al historial
        </button>
        <Link
          to={`/expense/${expense.id}/edit`}
          className="flex min-h-11 items-center rounded-xl bg-accent-600 px-4 font-bold text-on-accent active:bg-accent-700"
        >
          Editar
        </Link>
      </div>

      <section className="detail-hero bg-surface p-5 shadow-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-ink"><DesignIcon name={category} size={14} />{CATEGORY_LABELS[category]}</span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">{expense.description}</h2>
        <div className="detail-amount"><small>MONTO TOTAL</small><strong>{formatCents(toBaseCents(expense.amountCents, expense.fxRateToBase), snapshot.group.baseCurrency)}</strong>
          {expense.currency !== snapshot.group.baseCurrency && <p className="mt-2 text-xs text-slate-500">Moneda local: {formatCents(expense.amountCents, expense.currency)} · TC: 1 {expense.currency} = {expense.fxRateToBase} {snapshot.group.baseCurrency}</p>}
        </div>
        <div className="detail-payer">{payer && <MemberAvatar member={payer} size={36} />}<div className="flex-1"><small>Pagado íntegramente por</small><strong>{payer?.name ?? '—'}</strong></div><div className="text-right"><small>Fecha de cargo</small>{formatShortDate(expense.expenseDate)}</div></div>
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

      <section className="detail-split">
        <h3 className="mb-2 font-bold">División del gasto</h3>
        <p className="text-xs text-slate-500">{expense.splitType === 'exact' ? 'Montos exactos' : 'Partes iguales'} · {expenseSplits.length} participantes</p>
        <div className="split-bar" aria-hidden="true">{expenseSplits.map((split) => <span key={split.memberId} style={{ width: `${expense.amountCents ? split.shareCents / expense.amountCents * 100 : 0}%`, backgroundColor: memberById.get(split.memberId)?.color ?? 'var(--accent-strong)' }} />)}</div>
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
          {expenseSplits.map((split) => {
            const member = memberById.get(split.memberId)
            if (!member) return null
            return (
              <li key={split.memberId} className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 last:border-b-0">
                <MemberAvatar member={member} size={34} />
                <span className="flex-1 font-semibold text-slate-900">{member.name}<small className="block text-xs font-normal text-slate-500">{member.id === expense.paidBy ? 'Pagó el gasto' : 'Cuota asignada'}</small></span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatCents(split.shareCents, expense.currency)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="detail-audit px-4 py-3 text-slate-600">
        <p>Creado por <span className="font-semibold text-slate-900">{creator?.name ?? 'Integrante del grupo'}</span>.</p>
        <p>
          Último cambio por <span className="font-semibold text-slate-900">{updater?.name ?? creator?.name ?? 'Integrante del grupo'}</span>
          {' · '}{new Date(expense.updatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </section>

      <div className="flex gap-3">
        <Link to={`/expense/${expense.id}/edit`} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent-600 text-sm font-semibold text-on-accent"><DesignIcon name="edit" size={16} />Editar gasto</Link>
        <ConfirmButton label="Eliminar" confirmLabel="¿Eliminar?" className="detail-delete text-xs" onConfirm={() => {
          const now = new Date().toISOString()
          void ledgerStore.saveExpense({ ...expense, deletedAt: now, updatedAt: now, updatedBy: currentMemberId, changeLog: [...(expense.changeLog ?? []), { id: crypto.randomUUID(), memberId: currentMemberId, action: 'deleted', at: now }] }, expenseSplits)
          navigate('/history')
        }} />
      </div>
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
