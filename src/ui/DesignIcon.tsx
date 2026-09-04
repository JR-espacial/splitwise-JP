import type { ExpenseCategory } from '../domain/types'

type DesignIconName = ExpenseCategory | 'check' | 'share' | 'receipt' | 'plus' | 'arrow' | 'settle' | 'payment' | 'flow' | 'register' | 'magic' | 'group' | 'wallet' | 'history' | 'back' | 'save' | 'delete' | 'edit' | 'export' | 'camera'

/** Exact exported Figma assets, stored locally for offline use. */
export function DesignIcon({ name, size = 20 }: { name: DesignIconName; size?: number }) {
  return <img aria-hidden="true" alt="" src={`/design/${name}.svg`} width={size} height={size} className="design-icon" style={{ width: size, height: size }} />
}
