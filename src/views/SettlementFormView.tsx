import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { computeBalances } from '../domain/balances'
import { formatCents, parseAmountToCents } from '../domain/money'
import { suggestSettlements } from '../domain/settle'
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
  const canSave = amountCents !== null && amountCents > 0 && fromMember !== toMember

  return (
    <form
      className="flex flex-col gap-5"
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
      <div>
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 font-semibold text-slate-600">← Volver</button>
        <h2 className="text-xl font-bold text-slate-900">Registrar pago</h2>
        <p className="text-sm text-slate-500">Puede ser el total sugerido o cualquier pago parcial.</p>
      </div>

      <div>
        <label htmlFor="from-member" className={fieldLabel}>Quién pagó</label>
        <select id="from-member" value={fromMember} onChange={(event) => setFromMember(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900">
          {snapshot.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="to-member" className={fieldLabel}>A quién</label>
        <select id="to-member" value={toMember} onChange={(event) => setToMember(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900">
          {snapshot.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        {fromMember === toMember && <p className="mt-1 text-sm font-semibold text-red-600">Selecciona dos personas diferentes.</p>}
      </div>
      <div>
        <label htmlFor="settlement-amount" className={fieldLabel}>Monto en {snapshot.group.baseCurrency}</label>
        <input id="settlement-amount" inputMode="decimal" autoFocus placeholder="0,00" value={amountText} onChange={(event) => setAmountText(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-2xl font-bold tabular-nums text-slate-900" />
        {suggestion && (
          <p className="mt-1 text-sm text-slate-500">Saldo sugerido: {formatCents(suggestion.amountCents, snapshot.group.baseCurrency)}</p>
        )}
      </div>
      <div>
        <label htmlFor="settlement-date" className={fieldLabel}>Fecha</label>
        <input id="settlement-date" type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900" />
      </div>
      <button type="submit" disabled={!canSave} className="min-h-14 rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md active:bg-emerald-700 disabled:bg-slate-300">Guardar pago</button>
    </form>
  )
}
