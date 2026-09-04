import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDefaultFxRate, getLastCurrency, rememberFxRate, rememberLastCurrency } from '../data/fxDefaults'
import { getAutoFxRate } from '../data/fxService'
import type { LedgerSnapshot } from '../data/repository'
import { ledgerStore } from '../data/store'
import { CATEGORY_ICONS, CATEGORY_LABELS, expenseCategory } from '../domain/categories'
import { formatCents, parseAmountToCents, toBaseCents } from '../domain/money'
import { computeSplits, SplitError } from '../domain/split'
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
import { compressReceipt } from '../ui/receipts'

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
    editing ? editing.currency : getLastCurrency(base) ?? base,
  )
  const [fxRateText, setFxRateText] = useState(() =>
    editing
      ? String(editing.fxRateToBase)
      : String(getDefaultFxRate(getLastCurrency(base) ?? base, base) ?? ''),
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
        exactShares: splitType === 'exact' ? Object.fromEntries(exactByMember) : undefined,
      })
      rememberLastCurrency(currency, base)
      if (currency !== base) rememberFxRate(currency, base, fxRate)
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
          className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-2xl font-bold tabular-nums text-slate-900"
        />
      </div>

      <div>
        <span className={fieldLabel}>Moneda</span>
        <div className="grid grid-cols-3 gap-2">
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
        <p className="mt-2 text-sm text-slate-500">
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
          className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900"
        />
      </div>

      <div>
        <span className={fieldLabel}>Categoría</span>
        <div className="grid grid-cols-3 gap-2">
          {EXPENSE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`${chipBase} flex-col gap-1 ${value === category ? chipOn : chipOff}`}
            >
              <span aria-hidden>{CATEGORY_ICONS[value]}</span>
              <span>{CATEGORY_LABELS[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={fieldLabel}>Comprobante (opcional)</span>
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
          <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-400 bg-surface font-semibold text-slate-700 active:bg-slate-50">
            {receiptBusy ? 'Procesando imagen…' : '📷 Agregar foto'}
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
        <p className="mt-1 text-xs text-slate-500">La foto se comprime y queda disponible sin conexión.</p>
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
          className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900"
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
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 tabular-nums text-slate-900"
                />
              </label>
            ))}
            {amountCents !== null && exactDiff !== 0 && (
              <p className="text-sm font-semibold text-danger">
                {exactDiff > 0
                  ? `Faltan ${formatCents(exactDiff, currency)}`
                  : `Sobran ${formatCents(-exactDiff, currency)}`}
              </p>
            )}
          </div>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-14 flex-1 rounded-2xl border border-slate-300 bg-surface font-bold text-slate-700 active:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSave || receiptBusy}
          className="min-h-14 flex-[2] rounded-2xl bg-accent-600 text-lg font-bold text-on-accent shadow-md transition active:scale-[0.98] active:bg-accent-700 disabled:bg-slate-300 disabled:text-slate-600"
        >
          Guardar
        </button>
      </div>
    </form>
  )
}
