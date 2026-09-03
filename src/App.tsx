import { useEffect, useMemo } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { signOut, useSession } from './data/auth'
import { LocalFirstRepository } from './data/localFirstRepository'
import { ledgerStore, useLedger } from './data/store'
import { IdentityContext } from './ui/identityContext'
import { Layout } from './ui/Layout'
import { BalancesView } from './views/BalancesView'
import { ExpenseFormView } from './views/ExpenseFormView'
import { ExpenseDetailView } from './views/ExpenseDetailView'
import { HistoryView } from './views/HistoryView'
import { LoginScreen } from './views/LoginScreen'
import { SettlementFormView } from './views/SettlementFormView'

function Splash() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50">
      <p className="animate-pulse text-lg font-semibold text-slate-500">Cargando…</p>
    </main>
  )
}

export default function App() {
  const { loading, session } = useSession()
  if (loading) return <Splash />
  if (!session) return <LoginScreen />
  return <LedgerApp sessionEmail={session.user.email ?? ''} />
}

function LedgerApp({ sessionEmail }: { sessionEmail: string }) {
  const state = useLedger()

  useEffect(() => {
    ledgerStore.init(new LocalFirstRepository())
  }, [])

  const me = useMemo(
    () =>
      state.snapshot?.members.find(
        (m) => m.email !== null && m.email.toLowerCase() === sessionEmail.toLowerCase(),
      ) ?? null,
    [state.snapshot, sessionEmail],
  )

  const identity = useMemo(
    () =>
      me
        ? {
            currentMemberId: me.id,
            changeIdentity: () => {
              if (window.confirm('¿Cerrar sesión?')) void signOut()
            },
          }
        : null,
    [me],
  )

  if (state.status === 'loading') return <Splash />

  if (state.status === 'error' || !state.snapshot) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="font-semibold text-slate-900">No se pudo cargar el grupo.</p>
        <p className="text-sm text-slate-500">{state.loadError}</p>
        <button
          type="button"
          onClick={ledgerStore.retryLoad}
          className="min-h-12 rounded-2xl bg-emerald-600 px-6 font-bold text-white transition active:scale-[0.98] active:bg-emerald-700"
        >
          Reintentar
        </button>
      </main>
    )
  }

  if (!identity) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="font-semibold text-slate-900">
          {sessionEmail} no está en el grupo del roadtrip.
        </p>
        <p className="text-sm text-slate-500">
          Pide que agreguen tu correo a la tabla de miembros, o entra con otro correo.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-12 rounded-2xl bg-emerald-600 px-6 font-bold text-white transition active:scale-[0.98] active:bg-emerald-700"
        >
          Cerrar sesión
        </button>
      </main>
    )
  }

  const snapshot = state.snapshot

  return (
    <IdentityContext.Provider value={identity}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<BalancesView snapshot={snapshot} />} />
            <Route path="/history" element={<HistoryView snapshot={snapshot} />} />
            <Route path="/expense/new" element={<ExpenseFormView snapshot={snapshot} />} />
            <Route path="/expense/:id" element={<ExpenseDetailView snapshot={snapshot} />} />
            <Route path="/expense/:id/edit" element={<ExpenseFormView snapshot={snapshot} />} />
            <Route path="/settlement/new" element={<SettlementFormView snapshot={snapshot} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </IdentityContext.Provider>
  )
}
