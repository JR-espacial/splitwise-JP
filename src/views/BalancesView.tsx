import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { computeBalances } from '../domain/balances'
import { formatCents } from '../domain/money'
import { suggestSettlements } from '../domain/settle'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { ConfirmButton } from '../ui/ConfirmButton'
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

  const recordSettlement = (fromMember: string, toMember: string, amountCents: number) => {
    const now = new Date().toISOString()
    void ledgerStore.saveSettlement({
      id: crypto.randomUUID(),
      groupId: group.id,
      fromMember,
      toMember,
      amountCents,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="balances-heading">
        <h2 id="balances-heading" className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Balances
        </h2>
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {members.map((member) => {
            const cents = balanceByMember.get(member.id) ?? 0
            const isMe = member.id === currentMemberId
            return (
              <li
                key={member.id}
                className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-b-0"
              >
                <MemberAvatar member={member} size={36} />
                <span className="flex-1 font-semibold text-slate-900">
                  {member.name}
                  {isMe && <span className="ml-1 text-sm font-normal text-slate-500">(tú)</span>}
                </span>
                <span
                  className={`text-right font-bold tabular-nums ${
                    cents > 0 ? 'text-emerald-700' : cents < 0 ? 'text-red-600' : 'text-slate-400'
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
        className="flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md active:bg-emerald-700"
      >
        + Agregar gasto
      </Link>

      <section aria-labelledby="settle-heading">
        <h2 id="settle-heading" className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Settle up
        </h2>
        {transfers.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
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
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex-1 text-sm text-slate-900">
                    <span className="font-semibold">{from.name}</span>
                    {' → '}
                    <span className="font-semibold">{to.name}</span>
                    <span className="block text-lg font-bold tabular-nums">
                      {formatCents(transfer.amountCents, group.baseCurrency)}
                    </span>
                  </div>
                  <ConfirmButton
                    label="Marcar pagado"
                    confirmLabel="¿Confirmar?"
                    onConfirm={() =>
                      recordSettlement(transfer.fromMember, transfer.toMember, transfer.amountCents)
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
