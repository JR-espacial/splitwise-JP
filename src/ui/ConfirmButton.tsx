import { useEffect, useRef, useState } from 'react'

/**
 * Two-tap confirmation: first tap arms the button for a few seconds,
 * second tap fires the action. Avoids modals on a one-hand mobile UI.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = '',
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const handleClick = () => {
    if (armed) {
      if (timer.current) clearTimeout(timer.current)
      setArmed(false)
      onConfirm()
    } else {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), 3000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`min-h-11 rounded-xl px-4 font-semibold transition active:scale-95 ${
        armed ? 'bg-amber-500 text-amber-950' : 'bg-accent-600 text-on-accent'
      } ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
