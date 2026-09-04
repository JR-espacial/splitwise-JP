import { useLayoutEffect, useRef } from 'react'

/** Display thousands separators while keeping the stored text ungrouped. */
export function AmountInput({ value, onChange, autoFocus = false }: {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const [units = '', decimals] = value.split('.')
  const displayed = units.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimals === undefined ? '' : `.${decimals}`)

  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return
    let position = 0
    let remaining = caret.current
    while (position < displayed.length && remaining > 0) {
      if (displayed[position] !== ',') remaining--
      position++
    }
    input.current.setSelectionRange(position, position)
    caret.current = null
  }, [displayed])

  return <input
    ref={input}
    id="amount"
    inputMode="decimal"
    autoFocus={autoFocus}
    placeholder="0.00"
    value={displayed}
    onChange={(event) => {
      const text = event.target.value
      let raw = text.replace(/,/g, '')
      let position = text.slice(0, event.target.selectionStart ?? text.length).replace(/,/g, '').length
      // Deleting a separator should delete the adjacent digit, not trap the caret.
      const inputType = (event.nativeEvent as InputEvent).inputType
      if (raw === value && text !== displayed && inputType?.startsWith('delete')) {
        const index = inputType === 'deleteContentBackward' ? position - 1 : position
        if (index >= 0) {
          raw = raw.slice(0, index) + raw.slice(index + 1)
          position = index
        }
      }
      if (!/^\d*(\.\d{0,2})?$/.test(raw)) return
      if (raw.startsWith('.')) {
        raw = `0${raw}`
        position++
      }
      caret.current = position
      onChange(raw)
    }}
    className="w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-2xl font-bold tabular-nums text-slate-900"
  />
}
