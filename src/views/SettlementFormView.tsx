import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { computeBalances } from '../domain/balances'
import { formatCents, parseAmountToCents } from '../domain/money'
import { suggestSettlements } from '../domain/settle'
import { MemberAvatar } from '../ui/MemberAvatar'
import { DesignIcon } from '../ui/DesignIcon'
import { todayISO } from '../ui/dates'
import { useIdentity } from '../ui/identityContext'

const fieldLabel = 'mb-1 block text-sm font-semibold text-slate-700'

export function SettlementFormView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { currentMemberId } = useIdentity()
  const suggestion = useMemo(() => {
    const balances = computeBalances(
      snapshot.members.map((member) => member.id),
      snapshot.expenses,
      snapshot.splits,
      snapshot.settlements,
    )
    return suggestSettlements(balances).find(
      (item) => item.fromMember === params.get('from') && item.toMember === params.get('to'),
    )
  }, [params, snapshot])

  const first = snapshot.members[0]?.id ?? ''
  const second = snapshot.members.find((member) => member.id !== first)?.id ?? ''
  const [fromMember, setFromMember] = useState(params.get('from') ?? first)
  const [toMember, setToMember] = useState(params.get('to') ?? second)
  const [amountText, setAmountText] = useState(
    suggestion ? (suggestion.amountCents / 100).toFixed(2) : '',
  )
  const [settlementDate, setSettlementDate] = useState(todayISO())
  const amountCents = parseAmountToCents(amountText)
  const canSave = amountCents !== null && amountCents > 0 && fromMember !== toMember && settlementDate !== '' && snapshot.members.some((m) => m.id === fromMember) && snapshot.members.some((m) => m.id === toMember)
  const currentSuggestion = useMemo(() => suggestSettlements(computeBalances(
    snapshot.members.map((member) => member.id), snapshot.expenses, snapshot.splits, snapshot.settlements,
  )).find((item) => item.fromMember === fromMember && item.toMember === toMember), [snapshot, fromMember, toMember])
  const from = snapshot.members.find((member) => member.id === fromMember)
  const to = snapshot.members.find((member) => member.id === toMember)

  return (
    <form
      className="entry-form flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSave || amountCents === null) return
        const now = new Date().toISOString()
        void ledgerStore.saveSettlement({
          id: crypto.randomUUID(),
          groupId: snapshot.group.id,
          fromMember,
          toMember,
          amountCents,
          baseCurrency: snapshot.group.baseCurrency,
          settlementDate,
          createdBy: currentMemberId,
          updatedBy: currentMemberId,
          changeLog: [{ id: crypto.randomUUID(), memberId: currentMemberId, action: 'created', at: now }],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })
        navigate('/')
      }}
    >
      <h2 className="text-2xl font-bold tracking-tight">Registrar pago</h2>
      <div className="surface-card payment-preview">
        <div>{from && <MemberAvatar member={from} size={56} />}<strong>{from?.name ?? '—'}</strong><small>PAGADOR</small></div>
        <span className="arrow-circle"><DesignIcon name="arrow" /></span>
        <div>{to && <MemberAvatar member={to} size={56} />}<strong>{to?.name ?? '—'}</strong><small>DESTINO</small></div>
      </div>
      <fieldset><legend className={fieldLabel}>¿Quién pagó?</legend><div className="payment-options">{snapshot.members.map((member) => <button type="button" key={member.id} aria-pressed={member.id === fromMember} onClick={() => setFromMember(member.id)}>{member.name}</button>)}</div></fieldset>
      <fieldset><legend className={fieldLabel}>¿A quién se le pagó?</legend><div className="payment-options">{snapshot.members.map((member) => <button type="button" key={member.id} aria-pressed={member.id === toMember} onClick={() => setToMember(member.id)}>{member.name}</button>)}</div>
      {fromMember === toMember && <p className="mt-2 text-sm text-danger">Selecciona dos personas diferentes.</p>}</fieldset>
      <div className="payment-suggestion"><p>Deuda pendiente calculada</p><div><strong>{formatCents(currentSuggestion?.amountCents ?? 0, snapshot.group.baseCurrency)}</strong>{currentSuggestion && <button type="button" onClick={() => setAmountText((currentSuggestion.amountCents / 100).toFixed(2))}>Pagar total</button>}</div>{!currentSuggestion && <p className="mt-2 text-slate-500">Sin transferencia sugerida entre estas personas. Puedes registrar un pago parcial.</p>}</div>
      <div>
        <label htmlFor="settlement-amount" className={fieldLabel}>Monto a liquidar · {snapshot.group.baseCurrency}</label>
        <input id="settlement-amount" inputMode="decimal" placeholder="0,00" value={amountText} onChange={(event) => setAmountText(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-2xl font-bold tabular-nums text-slate-900" />

      </div>
      <div>
        <label htmlFor="settlement-date" className={fieldLabel}>Fecha</label>
        <input id="settlement-date" type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-surface px-3 text-slate-900" />
      </div>
      <button type="submit" disabled={!canSave} className="inline-flex items-center justify-center gap-2 min-h-14 rounded-2xl bg-accent-600 text-lg font-bold text-on-accent shadow-md active:bg-accent-700 disabled:bg-slate-300 disabled:text-white"><DesignIcon name="save" size={20} /> Guardar pago</button>
    </form>
  )
}
