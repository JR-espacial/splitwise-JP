import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDefaultFxRate, getLastCurrency, rememberFxRate, rememberLastCurrency } from '../data/fxDefaults'
import { getAutoFxRate } from '../data/fxService'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { formatCents, parseAmountToCents, toBaseCents } from '../domain/money'
import { computeSplits, SplitError } from '../domain/split'
import { CURRENCIES, type Currency, type Expense, type SplitType } from '../domain/types'
import { todayISO } from '../ui/dates'
import { useIdentity } from '../ui/identityContext'

function centsToText(cents: number): string {
  const units = Math.floor(cents / 100)
  const decimals = cents % 100
  return decimals === 0 ? String(units) : `${units}.${String(decimals).padStart(2, '0')}`
}

const SPLIT_LABELS: Record<SplitType, string> = {
  equal: 'Entre todos',
  subset: 'Algunos',
  exact: 'Montos exactos',
}

const fieldLabel = 'mb-1 block text-sm font-semibold text-slate-700'
const chipBase = 'flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold'
const chipOn = 'border-emerald-600 bg-emerald-600 text-white'
const chipOff = 'border-slate-300 bg-white text-slate-700 active:bg-slate-100'

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
    editing ? editing.currency : getLastCurrency() ?? base,
  )
  const [fxRateText, setFxRateText] = useState(() =>
    editing
      ? String(editing.fxRateToBase)
      : String(getDefaultFxRate(getLastCurrency() ?? base)),
  )
  const [paidBy, setPaidBy] = useState(editing ? editing.paidBy : currentMemberId)
  const [description, setDescription] = useState(editing ? editing.description : '')
  const [expenseDate, setExpenseDate] = useState(editing ? editing.expenseDate : todayISO())
  const [splitType, setSplitType] = useState<SplitType>(editing ? editing.splitType : 'equal')
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

  useEffect(() => {
    if (fxEdited || currency === base) return
    let cancelled = false
    void getAutoFxRate(currency).then((rate) => {
      if (cancelled || rate === null) return
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

  const exactByMember = new Map(
    members.map((m) => [m.id, parseAmountToCents(exactTexts[m.id] ?? '') ?? 0]),
  )
  const exactSum = [...exactByMember.values()].reduce((a, b) => a + b, 0)
  const exactDiff = (amountCents ?? 0) - exactSum

  const participants = members
    .filter((m) => {
      if (splitType === 'equal') return true
      if (splitType === 'subset') return subsetIds.has(m.id)
      return (exactByMember.get(m.id) ?? 0) > 0
    })
    .map((m) => m.id)

  const canSave =
    amountCents !== null &&
    amountCents > 0 &&
    description.trim() !== '' &&
    expenseDate !== '' &&
    fxValid &&
    participants.length > 0 &&
    (splitType !== 'exact' || exactDiff === 0)

  const toggleSubset = (memberId: string) => {
    setSubsetIds((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const selectCurrency = (next: Currency) => {
    setCurrency(next)
    if (next !== base) {
      setFxRateText(String(getDefaultFxRate(next)))
      setFxIsAuto(false)
      if (!editing) setFxEdited(false) // let the daily rate take over again
    }
  }

  const handleSave = () => {
    if (!canSave || amountCents === null) return
    const now = new Date().toISOString()
    const expense: Expense = {
      id: editing ? editing.id : crypto.randomUUID(),
      groupId: group.id,
      paidBy,
      amountCents,
      currency,
      fxRateToBase: fxRate,
      description: description.trim(),
      expenseDate,
      splitType,
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
        exactShares: splitType === 'exact' ? Object.fromEntries(exactByMember) : undefined,
      })
      rememberLastCurrency(currency)
      if (currency !== base) rememberFxRate(currency, fxRate)
      void ledgerStore.saveExpense(expense, splits)
      navigate(-1)
    } catch (error) {
      setFormError(error instanceof SplitError ? error.message : 'No se pudo guardar el gasto')
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
    >
      <h2 className="text-xl font-bold text-slate-900">
        {editing ? 'Editar gasto' : 'Nuevo gasto'}
      </h2>

      <div>
        <label htmlFor="amount" className={fieldLabel}>
          Monto
        </label>
        <input
          id="amount"
          inputMode="decimal"
          autoFocus={!editing}
          placeholder="0,00"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-2xl font-bold tabular-nums text-slate-900"
        />
      </div>

      <div>
        <span className={fieldLabel}>Moneda</span>
        <div className="grid grid-cols-5 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCurrency(c)}
              className={`${chipBase} ${c === currency ? chipOn : chipOff}`}
            >
              {c}
            </button>
          ))}
        </div>
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
              setFxEdited(true)
              setFxIsAuto(false)
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 tabular-nums text-slate-900"
          />
          <p className="mt-1 text-sm text-slate-500">
            {amountCents !== null && fxValid && (
              <>≈ {formatCents(toBaseCents(amountCents, fxRate), base)} · </>
            )}
            {fxIsAuto ? 'tasa del día (BCE), editable' : 'tasa manual'}
          </p>
        </div>
      )}

      <div>
        <span className={fieldLabel}>Pagó</span>
        <div className="grid grid-cols-2 gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaidBy(m.id)}
              className={`${chipBase} ${m.id === paidBy ? chipOn : chipOff}`}
            >
              {m.name}
              {m.id === currentMemberId && ' (tú)'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="description" className={fieldLabel}>
          Descripción
        </label>
        <input
          id="description"
          placeholder="¿Qué pagaron?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
        />
      </div>

      <div>
        <label htmlFor="expense-date" className={fieldLabel}>
          Fecha
        </label>
        <input
          id="expense-date"
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
        />
      </div>

      <div>
        <span className={fieldLabel}>Dividir</span>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SPLIT_LABELS) as SplitType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSplitType(type)}
              className={`${chipBase} ${type === splitType ? chipOn : chipOff}`}
            >
              {SPLIT_LABELS[type]}
            </button>
          ))}
        </div>

        {splitType === 'subset' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleSubset(m.id)}
                aria-pressed={subsetIds.has(m.id)}
                className={`${chipBase} ${subsetIds.has(m.id) ? chipOn : chipOff}`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {splitType === 'exact' && (
          <div className="mt-3 flex flex-col gap-2">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm font-semibold text-slate-700">{m.name}</span>
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={exactTexts[m.id] ?? ''}
                  onChange={(e) =>
                    setExactTexts((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 tabular-nums text-slate-900"
                />
              </label>
            ))}
            {amountCents !== null && exactDiff !== 0 && (
              <p className="text-sm font-semibold text-red-600">
                {exactDiff > 0
                  ? `Faltan ${formatCents(exactDiff, currency)}`
                  : `Sobran ${formatCents(-exactDiff, currency)}`}
              </p>
            )}
          </div>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-14 flex-1 rounded-2xl border border-slate-300 bg-white font-bold text-slate-700 active:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="min-h-14 flex-[2] rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md active:bg-emerald-700 disabled:bg-slate-300"
        >
          Guardar
        </button>
      </div>
    </form>
  )
}
