import { createContext, useContext } from 'react'

interface IdentityContextValue {
  currentMemberId: string
  changeIdentity: () => void
}

export const IdentityContext = createContext<IdentityContextValue | null>(null)

export function useIdentity(): IdentityContextValue {
  const value = useContext(IdentityContext)
  if (!value) throw new Error('useIdentity must be used inside IdentityContext')
  return value
}
