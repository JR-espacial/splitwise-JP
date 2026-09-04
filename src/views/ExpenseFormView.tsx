import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDefaultFxRate, rememberFxRate } from '../data/fxDefaults'
import { getAutoFxRate } from '../data/fxService'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { CATEGORY_LABELS, expenseCategory } from '../domain/categories'
import { CURRENCY_SYMBOLS, formatCents, parseAmountToCents, toBaseCents } from '../domain/money'
import { computeSplits, percentageShares, SplitError } from '../domain/split'
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  type Currency,
  type Expense,
  type ExpenseCategory,
  type SplitType,
} from '../domain/types'
import { todayISO } from '../ui/dates'
import { useIdentity } from '../ui/identityContext'
import { AmountInput } from '../ui/AmountInput'
import { DesignIcon } from '../ui/DesignIcon'
import { MemberAvatar } from '../ui/MemberAvatar'
import { compressReceipt } from '../ui/receipts'

function centsToText(cents: number): string {
  const units = Math.floor(cents / 100)
  const decimals = cents % 100
  return decimals === 0 ? String(units) : `${units}.${String(decimals).padStart(2, '0')}`
}

type SplitMode = 'equal' | 'exact' | 'percentage'
const SPLIT_LABELS: Record<SplitMode, string> = {
  equal: 'Partes iguales', exact: 'Montos exactos', percentage: 'Porcentajes',
}

const fieldLabel = 'mb-1 block text-sm font-semibold text-slate-700'
const chipBase = 'flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold'
const chipOn = 'border-accent-600 bg-accent-600 text-on-accent'
const chipOff = 'border-slate-300 bg-surface text-slate-700 active:bg-slate-100'

export function ExpenseFormView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentMemberId } = useIdentity()
  const { group, members } = snapshot
  const base = group.baseCurrency

  const editing = useMemo(
    () => (id ? snapshot.expenses.find((e) => e.id === id) ?? null : null),
    [id, snapshot.expenses],
  )
  const editingSplits = useMemo(
    () => (editing ? snapshot.splits.filter((s) => s.expenseId === editing.id) : []),
    [editing, snapshot.splits],
  )

  const [amountText, setAmountText] = useState(editing ? centsToText(editing.amountCents) : '')
  const [currency, setCurrency] = useState<Currency>(
    editing ? editing.currency : 'MXN',
  )
  const [fxRateText, setFxRateText] = useState(() =>
    editing
      ? String(editing.fxRateToBase)
      : String(getDefaultFxRate('MXN', base) ?? ''),
  )
  const [paidBy, setPaidBy] = useState(editing ? editing.paidBy : currentMemberId)
  const [description, setDescription] = useState(editing ? editing.description : '')
  const [category, setCategory] = useState<ExpenseCategory>(
    expenseCategory(editing?.category),
  )
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(
    editing?.receiptDataUrl ?? null,
  )
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [expenseDate, setExpenseDate] = useState(editing ? editing.expenseDate : todayISO())
  const [splitMode, setSplitMode] = useState<SplitMode>(editing?.splitType === 'exact' ? 'exact' : 'equal')
  const [participantMode, setParticipantMode] = useState<'all' | 'some'>(editing && editingSplits.length < members.length ? 'some' : 'all')
  const [percentageTexts, setPercentageTexts] = useState<Record<string, string>>({})
  const [subsetIds, setSubsetIds] = useState<Set<string>>(
    () =>
      new Set(
        editing && editing.splitType !== 'equal'
          ? editingSplits.map((s) => s.memberId)
          : members.map((m) => m.id),
      ),
  )
  const [exactTexts, setExactTexts] = useState<Record<string, string>>(() =>
    editing && editing.splitType === 'exact'
      ? Object.fromEntries(editingSplits.map((s) => [s.memberId, centsToText(s.shareCents)]))
      : {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  // Frozen rates of existing expenses are never auto-updated.
  const [fxEdited, setFxEdited] = useState(editing !== null)
  const [fxIsAuto, setFxIsAuto] = useState(false)
  const [fxLoading, setFxLoading] = useState(false)

  useEffect(() => {
    if (fxEdited || currency === base) return
    let cancelled = false
    setFxLoading(true)
    void getAutoFxRate(currency, base).then((rate) => {
      if (cancelled) return
      setFxLoading(false)
      if (rate === null) return
      setFxRateText(String(rate))
      setFxIsAuto(true)
    })
    return () => {
      cancelled = true
    }
  }, [currency, base, fxEdited])

  if (id && !editing) {
    return <p className="py-10 text-center text-slate-500">Gasto no encontrado.</p>
  }

  const amountCents = parseAmountToCents(amountText)
  const fxRate = currency === base ? 1 : Number(fxRateText)
  const fxValid = Number.isFinite(fxRate) && fxRate > 0

  const selectedMembers = members.filter((m) => participantMode === 'all' || subsetIds.has(m.id))
  const participants = selectedMembers.map((m) => m.id)
  const splitType: SplitType = splitMode === 'equal' ? (participantMode === 'all' ? 'equal' : 'subset') : 'exact'
  const exactByMember = new Map(selectedMembers.map((m) => [m.id, parseAmountToCents(exactTexts[m.id] || '0')]))
  const exactValid = [...exactByMember.values()].every((value) => value !== null && value >= 0)
  const exactSum = [...exactByMember.values()].reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const weights = Object.fromEntries(selectedMembers.map((m) => [m.id, parseAmountToCents(percentageTexts[m.id] || '0')]))
  const percentSum = Object.values(weights).reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const percentagesValid = Object.values(weights).every((value) => value !== null && value >= 0 && value <= 10000) && percentSum === 10000
  let shares: Record<string, number> = {}
  if (splitMode === 'exact') shares = Object.fromEntries([...exactByMember].map(([key, value]) => [key, value ?? 0]))
  else if (amountCents !== null && amountCents > 0 && participants.length) {
    if (splitMode === 'percentage' && percentagesValid) shares = percentageShares(amountCents, weights as Record<string, number>)
    if (splitMode === 'equal') shares = Object.fromEntries(computeSplits({ expenseId: '', amountCents, paidBy, splitType, participants }).map((split) => [split.memberId, split.shareCents]))
  }
  const assigned = Object.values(shares).reduce((sum, value) => sum + value, 0)
  const remaining = (amountCents ?? 0) - assigned
  const splitValid = participants.length > 0 && (splitMode === 'exact' ? exactValid && exactSum === amountCents : splitMode === 'percentage' ? percentagesValid : true)
  const canSave = amountCents !== null && amountCents > 0 && description.trim() !== '' && expenseDate !== '' && fxValid && splitValid
  const payerName = members.find((m) => m.id === paidBy)?.name ?? 'quien pagó'
  const currencySymbol = new Intl.NumberFormat('es-MX', { style: 'currency', currency }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency

  const toggleSubset = (memberId: string) => {
    const next = new Set(participantMode === 'all' ? members.map((m) => m.id) : subsetIds)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    setSubsetIds(next)
    setParticipantMode('some')
  }

  const selectCurrency = (next: Currency) => {
    setCurrency(next)
    setFxLoading(false)
    if (next !== base) {
      setFxRateText(String(next === editing?.currency ? editing.fxRateToBase : getDefaultFxRate(next, base) ?? ''))
      setFxIsAuto(false)
      if (!editing) setFxEdited(false) // let the daily rate take over again
    }
  }

  const handleSave = () => {
    if (!canSave || amountCents === null) return
    const now = new Date().toISOString()
    const change = {
      id: crypto.randomUUID(),
      memberId: currentMemberId,
      action: editing ? ('updated' as const) : ('created' as const),
      at: now,
    }
    const expense: Expense = {
      id: editing ? editing.id : crypto.randomUUID(),
      groupId: group.id,
      paidBy,
      amountCents,
      currency,
      fxRateToBase: fxRate,
      baseCurrency: base,
      description: description.trim(),
      expenseDate,
      splitType,
      category,
      receiptDataUrl,
      createdBy: editing?.createdBy ?? currentMemberId,
      updatedBy: currentMemberId,
      changeLog: [...(editing?.changeLog ?? []), change],
      createdAt: editing ? editing.createdAt : now,
      updatedAt: now,
      deletedAt: editing ? editing.deletedAt : null,
    }
    try {
      const splits = computeSplits({
        expenseId: expense.id,
        amountCents,
        paidBy,
        splitType,
        participants,
        exactShares: splitType === 'exact' ? shares : undefined,
      })
      if (currency !== base) rememberFxRate(currency, base, fxRate)
      void ledgerStore.saveExpense(expense, splits)
      navigate(-1)
    } catch (error) {
      setFormError(error instanceof SplitError ? error.message : 'No se pudo guardar el gasto')
    }
  }

  return (
    <form
      className="entry-form flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
    >
      <button type="button" onClick={() => navigate(-1)} className="self-start rounded-full bg-accent-50 px-3 py-2 text-xs font-semibold text-slate-600">Cancelar</button>

      <div className="amount-panel">
        <label htmlFor="amount" className={fieldLabel}>
          Monto total <span className="sr-only">en {currency}</span>
        </label>
        <div className="amount-input-row">
          <span className="amount-currency" aria-hidden="true">{CURRENCY_SYMBOLS[currency]}</span>
          <AmountInput value={amountText} onChange={setAmountText} autoFocus={!editing} />
        </div>
      </div>

      <div>
        <span className={fieldLabel}>Moneda del pago</span>
        <div className="currency-options">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCurrency(c)}
              aria-pressed={c === currency}
              className={`${chipBase} ${c === currency ? chipOn : chipOff}`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="travel-tip mt-3 text-slate-500">
          {base === 'MXN' ? 'Si pagaste con tarjeta, puedes registrar en MXN el cargo que aparece en tu banco. Para efectivo, usa la moneda original.' : `Los balances y pagos se calculan en ${base}.`}
        </p>
      </div>

      {currency !== base && (
        <div>
          <label htmlFor="fx-rate" className={fieldLabel}>
            Tipo de cambio a {base} (1 {currency} = ? {base})
          </label>
          <input
            id="fx-rate"
            inputMode="decimal"
            value={fxRateText}
            onChange={(e) => {
              setFxRateText(e.target.value.replace(',', '.'))
              setFxLoading(false)
              setFxEdited(true)
              setFxIsAuto(false)
            }}
            className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 tabular-nums text-slate-900"
          />
          <p className="mt-1 text-sm text-slate-500">
            {amountCents !== null && fxValid && (
              <>≈ {formatCents(toBaseCents(amountCents, fxRate), base)} · </>
            )}
            {fxLoading ? 'Consultando tipo de cambio…' : fxIsAuto ? 'tasa de referencia (BCE), editable' : fxValid ? 'tasa manual guardada con el gasto' : 'Consulta el cambio o introduce una tasa para continuar'}
          </p>
          <p className="mt-1 text-xs text-slate-500">La tasa es orientativa y puede diferir del cargo del banco. Queda fija al guardar.</p>
        </div>
      )}

      <div>
        <span className={fieldLabel}>¿Quién pagó el total?</span>
        <div className="payer-options">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaidBy(m.id)}
              aria-pressed={m.id === paidBy}
              className={`${chipBase} ${m.id === paidBy ? chipOn : chipOff}`}
            >
              <MemberAvatar member={m} size={40} />
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="description" className={fieldLabel}>
          Concepto del gasto
        </label>
        <input
          id="description"
          placeholder="¿En qué se gastó? Ej. Cena, tren Praga…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900"
        />
      </div>

      <div>
        <span className={fieldLabel}>Categoría</span>
        <div className="category-options grid grid-cols-3 gap-2">
          {EXPENSE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={value === category}
              className={`${chipBase} flex-col gap-1 ${value === category ? chipOn : chipOff}`}
            >
              <span className="category-icon-tile"><DesignIcon name={value} size={20} /></span>
              <span>{CATEGORY_LABELS[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="date-receipt-grid">
      <div>
        <label htmlFor="expense-date" className={fieldLabel}>
          Fecha
        </label>
        <input
          id="expense-date"
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900"
        />
      </div>

      <div>
        <span className={fieldLabel}>Foto comprobante</span>
        {receiptDataUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface">
            <img src={receiptDataUrl} alt="Comprobante del gasto" className="max-h-64 w-full object-contain" />
            <button
              type="button"
              onClick={() => setReceiptDataUrl(null)}
              className="min-h-11 w-full border-t border-slate-200 font-semibold text-danger active:bg-danger-soft"
            >
              Quitar comprobante
            </button>
          </div>
        ) : (
          <label className="flex min-h-12 gap-2 cursor-pointer items-center justify-center rounded-2xl border border-transparent bg-surface text-xs font-semibold text-accent-ink active:bg-slate-50">
            <DesignIcon name="camera" size={18} /> {receiptBusy ? 'Procesando imagen…' : 'Subir ticket'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={receiptBusy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                setReceiptBusy(true)
                setFormError(null)
                void compressReceipt(file)
                  .then(setReceiptDataUrl)
                  .catch((error: unknown) =>
                    setFormError(error instanceof Error ? error.message : 'No se pudo leer la imagen'),
                  )
                  .finally(() => setReceiptBusy(false))
              }}
            />
          </label>
        )}
      </div>

      </div>

      <section className="split-section" aria-labelledby="split-heading">
        <div className="split-title"><h2 id="split-heading">División del gasto</h2><span>{participants.length} de {members.length} seleccionados</span></div>
        <fieldset>
          <legend>¿Entre quiénes se divide?</legend>
          <div className="split-segments participants-segments">
            <button type="button" aria-pressed={participantMode === 'all'} onClick={() => setParticipantMode('all')}><DesignIcon name="group" size={18} />Todos ({members.length})</button>
            <button type="button" aria-pressed={participantMode === 'some'} onClick={() => setParticipantMode('some')}><DesignIcon name="group" size={18} />Algunos ({subsetIds.size})</button>
          </div>
          <div className="participant-chips" role="group" aria-label="Participantes del gasto">
            {[...members].sort((a, b) => Number(participants.includes(b.id)) - Number(participants.includes(a.id))).map((member) => {
              const selected = participants.includes(member.id)
              return <button key={member.id} type="button" aria-pressed={selected} onClick={() => toggleSubset(member.id)}><MemberAvatar member={member} size={24} /><span>{member.name}</span><span aria-hidden="true">{selected ? '✓' : '+'}</span></button>
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Modalidad de división</legend>
          <div className="split-segments mode-segments">
            {(Object.keys(SPLIT_LABELS) as SplitMode[]).map((mode) => <button key={mode} type="button" aria-pressed={splitMode === mode} onClick={() => setSplitMode(mode)}>{SPLIT_LABELS[mode]}</button>)}
          </div>
        </fieldset>
        <div className="allocation-card">
          <div className="allocation-heading"><h3><DesignIcon name="payment" size={18} />{splitMode === 'exact' ? 'Asignar importe por persona' : splitMode === 'percentage' ? 'Asignar porcentaje por persona' : 'Importe por persona'}</h3><span>Moneda: {currency}</span></div>
          {selectedMembers.map((member) => <div key={member.id} className="allocation-row">
            <MemberAvatar member={member} size={40} />
            <div className="allocation-person"><strong>{member.name}</strong><small>{member.id === paidBy ? 'Pagó el gasto' : `Debe a ${payerName}`}</small></div>
            {splitMode === 'equal' ? <strong className="allocation-value">{formatCents(shares[member.id] ?? 0, currency)}</strong> : <label className="allocation-input"><span aria-hidden="true">{splitMode === 'percentage' ? '%' : currencySymbol}</span><input aria-label={`${splitMode === 'percentage' ? 'Porcentaje' : 'Importe'} de ${member.name}`} inputMode="decimal" placeholder="0.00" onBlur={(event) => {
              const value = parseAmountToCents(event.target.value)
              if (value !== null && event.target.value.trim() !== '') {
                const update = splitMode === 'percentage' ? setPercentageTexts : setExactTexts
                update((previous) => ({ ...previous, [member.id]: (value / 100).toFixed(2) }))
              }
            }} value={(splitMode === 'percentage' ? percentageTexts : exactTexts)[member.id] ?? ''} onChange={(event) => {
              const update = splitMode === 'percentage' ? setPercentageTexts : setExactTexts
              update((previous) => ({ ...previous, [member.id]: event.target.value }))
            }} /></label>}
          </div>)}
          {participants.length === 0 && <p className="py-4 text-sm text-danger">Selecciona al menos una persona.</p>}
          <div className="allocation-footer" aria-live="polite">
            <p><span>Total asignado</span><strong>{formatCents(assigned, currency)}</strong></p>
            <div className={`allocation-status ${splitValid && amountCents && amountCents > 0 ? 'is-balanced' : 'is-incomplete'}`}>
              <span>{splitMode === 'percentage' && !percentagesValid ? `Asignado: ${(percentSum / 100).toLocaleString('es-MX')}% de 100%` : splitMode === 'exact' && !exactValid ? 'Revisa los importes' : splitValid && amountCents && amountCents > 0 ? '✓ Suma completa y cuadrada' : 'Reparto por completar'}</span>
              <strong>Restante: {formatCents(remaining, currency)}</strong>
            </div>
            {splitMode === 'percentage' && <small className="mt-2 block text-slate-500">Al guardar, los porcentajes se convierten en importes exactos por persona.</small>}
          </div>
        </div>
      </section>

      {formError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-14 flex-1 rounded-2xl border border-slate-300 bg-surface font-bold text-slate-700 active:bg-slate-100"
        >
          Descartar borrador
        </button>
        <button
          type="submit"
          disabled={!canSave || receiptBusy}
          className="inline-flex items-center justify-center gap-2 min-h-14 flex-[2] rounded-2xl bg-accent-600 text-lg font-bold text-on-accent shadow-md transition active:scale-[0.98] active:bg-accent-700 disabled:bg-slate-300 disabled:text-slate-600"
        >
          <DesignIcon name="save" size={18} /> Guardar gasto
        </button>
      </div>
    </form>
  )
}
