import { Link, NavLink, Outlet } from 'react-router-dom'
import { ledgerStore, useLedger } from '../data/store'
import { useIdentity } from './identityContext'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 flex-1 items-center justify-center rounded-xl text-sm font-semibold ${
    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 active:bg-slate-100'
  }`

export function Layout() {
  const { snapshot, writeError, sync } = useLedger()
  const { currentMemberId, changeIdentity } = useIdentity()
  const me = snapshot?.members.find((m) => m.id === currentMemberId)

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-emerald-700 px-4 py-3 text-white">
        <h1 className="text-lg font-bold">{snapshot?.group.name ?? 'Roadtrip'}</h1>
        <button
          type="button"
          onClick={changeIdentity}
          className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold active:bg-emerald-800"
          aria-label="Cerrar sesión"
        >
          {me ? (
            <>
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-slate-900"
                style={{ backgroundColor: me.color }}
              >
                {me.name.charAt(0)}
              </span>
              {me.name}
            </>
          ) : (
            'Cambiar'
          )}
        </button>
      </header>

      {sync && (!sync.online || sync.pendingCount > 0) && (
        <div role="status" className="bg-amber-500 px-4 py-1.5 text-center text-sm font-semibold text-amber-950">
          {sync.online
            ? `Sincronizando ${sync.pendingCount} ${sync.pendingCount === 1 ? 'cambio' : 'cambios'}…`
            : 'Sin conexión — tus cambios se guardan en este teléfono'}
        </div>
      )}

      {writeError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-red-600 px-4 py-2 text-sm text-white"
        >
          <span>No se pudo sincronizar: {writeError}</span>
          <button
            type="button"
            onClick={ledgerStore.dismissWriteError}
            className="min-h-11 shrink-0 px-2 font-bold"
          >
            Cerrar
          </button>
        </div>
      )}

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-center gap-2 border-t border-slate-200 bg-white px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <NavLink to="/" end className={tabClass}>
          Balances
        </NavLink>
        <Link
          to="/expense/new"
          aria-label="Agregar gasto"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-3xl font-bold text-white shadow-lg active:bg-emerald-700"
        >
          +
        </Link>
        <NavLink to="/history" className={tabClass}>
          Historial
        </NavLink>
      </nav>
    </div>
  )
}
