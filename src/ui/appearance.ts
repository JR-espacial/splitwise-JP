import { useLayoutEffect, useState } from 'react'

export const THEME_COLORS = [
  { id: 'blue', label: 'Azul', swatch: '#3b82f6' },
  { id: 'yellow', label: 'Amarillo', swatch: '#facc15' },
  { id: 'green', label: 'Verde', swatch: '#22a06b' },
  { id: 'red', label: 'Rojo', swatch: '#ef4444' },
  { id: 'orange', label: 'Naranja', swatch: '#f97316' },
] as const

export type ThemeColor = (typeof THEME_COLORS)[number]['id']
export interface Appearance {
  color: ThemeColor
  mode: 'light' | 'dark'
}

const DEFAULT_APPEARANCE: Appearance = { color: 'blue', mode: 'light' }
const LAST_KEY = 'roadtrip:appearance:last'
const memberKey = (memberId: string) => `roadtrip:appearance:member:${memberId}`

export function readAppearance(key: string): Appearance {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (value && typeof value === 'object' && 'color' in value && 'mode' in value &&
      THEME_COLORS.some((color) => color.id === value.color) &&
      (value.mode === 'light' || value.mode === 'dark')) {
      return value as Appearance
    }
  } catch {
    // Private browsing or an old/invalid preference should never block access.
  }
  return { ...DEFAULT_APPEARANCE }
}

function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.theme = appearance.color
  document.documentElement.dataset.mode = appearance.mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', appearance.mode === 'dark' ? '#111827' : '#f7f8fa',
  )
}

export function initializeAppearance() {
  applyAppearance(readAppearance(LAST_KEY))
}

/** Preferences belong to one member on this device; ledger data is unaffected. */
export function useAppearance(memberId: string) {
  const [appearance, setAppearance] = useState(() => readAppearance(memberKey(memberId)))
  const [storageError, setStorageError] = useState(false)

  useLayoutEffect(() => {
    applyAppearance(appearance)
    try {
      localStorage.setItem(memberKey(memberId), JSON.stringify(appearance))
      localStorage.setItem(LAST_KEY, JSON.stringify(appearance))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [appearance, memberId])

  return { appearance, setAppearance, storageError }
}
