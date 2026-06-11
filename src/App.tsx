import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { clearCurrentMemberId, getCurrentMemberId, setCurrentMemberId } from './data/identity'
import { LocalFirstRepository } from './data/localFirstRepository'
import { ledgerStore, useLedger } from './data/store'
import { IdentityContext } from './ui/identityContext'
import { Layout } from './ui/Layout'
import { BalancesView } from './views/BalancesView'
import { ExpenseFormView } from './views/ExpenseFormView'
import { HistoryView } from './views/HistoryView'
import { IdentityScreen } from './views/IdentityScreen'

export default function App() {
  const state = useLedger()
  const [memberId, setMemberId] = useState<string | null>(getCurrentMemberId)

  useEffect(() => {
    ledgerStore.init(new LocalFirstRepository())
  }, [])

  const identity = useMemo(
    () =>
      memberId
        ? {
            currentMemberId: memberId,
            changeIdentity: () => {
              clearCurrentMemberId()
              setMemberId(null)
            },
          }
        : null,
    [memberId],
  )

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="animate-pulse text-lg font-semibold text-slate-500">Cargando…</p>
      </main>
    )
  }

  if (state.status === 'error' || !state.snapshot) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="font-semibold text-slate-900">No se pudo cargar el grupo.</p>
        <p className="text-sm text-slate-500">{state.loadError}</p>
        <button
          type="button"
          onClick={ledgerStore.retryLoad}
          className="min-h-12 rounded-2xl bg-emerald-600 px-6 font-bold text-white active:bg-emerald-700"
        >
          Reintentar
        </button>
      </main>
    )
  }

  const snapshot = state.snapshot
  const validMember = identity && snapshot.members.some((m) => m.id === identity.currentMemberId)

  if (!identity || !validMember) {
    return (
      <IdentityScreen
        members={snapshot.members}
        onSelect={(id) => {
          setCurrentMemberId(id)
          setMemberId(id)
        }}
      />
    )
  }

  return (
    <IdentityContext.Provider value={identity}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<BalancesView snapshot={snapshot} />} />
            <Route path="/history" element={<HistoryView snapshot={snapshot} />} />
            <Route path="/expense/new" element={<ExpenseFormView snapshot={snapshot} />} />
            <Route path="/expense/:id" element={<ExpenseFormView snapshot={snapshot} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </IdentityContext.Provider>
  )
}
