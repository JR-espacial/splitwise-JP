import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { computeBalances } from '../domain/balances'
import { Icon } from '../ui/Icon'
import { computeTripTotals } from '../domain/totals'
import { formatCents } from '../domain/money'
import { suggestSettlements } from '../domain/settle'
import type { LedgerSnapshot } from '../data/repository'
import { MemberAvatar } from '../ui/MemberAvatar'
import { useIdentity } from '../ui/identityContext'

export function BalancesView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const { currentMemberId } = useIdentity()
  const { group, members, expenses, splits, settlements } = snapshot

  const balances = useMemo(
    () =>
      computeBalances(
        members.map((m) => m.id),
        expenses,
        splits,
        settlements,
      ),
    [members, expenses, splits, settlements],
  )
  const transfers = useMemo(() => suggestSettlements(balances), [balances])
  const balanceByMember = new Map(balances.map((b) => [b.memberId, b.balanceCents]))
  const memberById = new Map(members.map((m) => [m.id, m]))

  const myBalance = balanceByMember.get(currentMemberId) ?? 0
  const totals = computeTripTotals(expenses, splits)

  return (
    <div className="animate-rise flex flex-col gap-6">
      <section className="balance-hero" aria-label="Resumen de tu balance">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-on-accent/80">Tu balance</span><span className="hero-badge"><Icon name="wallet" /> {group.baseCurrency}</span></div>
        <p className="my-3 break-words text-4xl font-semibold tracking-tight tabular-nums">{formatCents(Math.abs(myBalance), group.baseCurrency)}</p>
        <p className="text-sm text-on-accent/80">{myBalance > 0 ? 'Te deben · cuentas claras, viaje tranquilo' : myBalance < 0 ? 'Por pagar · este es tu saldo pendiente' : 'Estás al día · disfruta el viaje'}</p>
        <div className="mt-6 flex items-end justify-between gap-3 border-t border-on-accent/20 pt-4">
          <div><p className="text-xs text-on-accent/80">Total del viaje</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatCents(totals.totalBaseCents, group.baseCurrency)}</p></div>
          <span className="text-xs text-on-accent/80">{totals.expenseCount} {totals.expenseCount === 1 ? 'gasto' : 'gastos'} · {members.length} personas</span>
        </div>
      </section>
      <section aria-labelledby="balances-heading">
        <h2 id="balances-heading" className="mb-3 text-lg font-bold tracking-tight text-slate-900">
          El grupo
        </h2>
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
          {members.map((member) => {
            const cents = balanceByMember.get(member.id) ?? 0
            const isMe = member.id === currentMemberId
            return (
              <li
                key={member.id}
                className="flex min-h-20 items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <MemberAvatar member={member} size={36} />
                <span className="flex-1 font-semibold text-slate-900">
                  {member.name}
                  {isMe && <span className="ml-1 text-sm font-normal text-slate-500">(tú)</span>}
                </span>
                <span
                  className={`text-right font-bold tabular-nums ${
                    cents > 0 ? 'text-success' : cents < 0 ? 'text-danger' : 'text-slate-400'
                  }`}
                >
                  {formatCents(cents, group.baseCurrency)}
                  <span className="block text-xs font-normal text-slate-500">
                    {cents > 0 ? 'le deben' : cents < 0 ? 'debe' : 'al día'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <Link
        to="/expense/new"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-accent-600 text-lg font-bold text-on-accent shadow-md transition active:scale-[0.98] active:bg-accent-700"
      >
        + Agregar gasto
      </Link>

      <section aria-labelledby="settle-heading">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="settle-heading" className="text-base font-bold tracking-tight text-slate-900">Liquidar deudas</h2>
          <Link to="/settlement/new" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-accent-ink active:bg-accent-50">Registrar otro pago</Link>
        </div>
        {transfers.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-surface px-4 py-6 text-center text-slate-500">
            Todos al día 🎉
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.map((transfer) => {
              const from = memberById.get(transfer.fromMember)
              const to = memberById.get(transfer.toMember)
              if (!from || !to) return null
              return (
                <li
                  key={`${transfer.fromMember}-${transfer.toMember}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-surface px-4 py-3 shadow-sm"
                >
                  <div className="flex-1 text-sm text-slate-900">
                    <span className="font-semibold">{from.name}</span>
                    {' → '}
                    <span className="font-semibold">{to.name}</span>
                    <span className="block text-lg font-bold tabular-nums">
                      {formatCents(transfer.amountCents, group.baseCurrency)}
                    </span>
                  </div>
                  <Link
                    to={`/settlement/new?from=${transfer.fromMember}&to=${transfer.toMember}`}
                    className="flex min-h-11 shrink-0 items-center rounded-xl bg-accent-600 px-3 text-sm font-bold text-on-accent active:bg-accent-700"
                  >
                    Registrar
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
