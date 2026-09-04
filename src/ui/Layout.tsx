import { useState } from 'react'
import { ProfileDialog } from './ProfileDialog'
import { useAppearance } from './appearance'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ledgerStore, useLedger } from '../data/store'
import { Icon } from './Icon'
import { useIdentity } from './identityContext'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col gap-1 items-center justify-center rounded-2xl text-xs font-semibold transition-colors ${
    isActive ? 'bg-accent-50 text-accent-ink' : 'text-slate-500 active:bg-slate-100'
  }`

export function Layout() {
  const { snapshot, writeError, sync } = useLedger()
  const { currentMemberId, changeIdentity } = useIdentity()
  const [profileOpen, setProfileOpen] = useState(false)
  const { appearance, setAppearance, storageError } = useAppearance(currentMemberId)
  const me = snapshot?.members.find((m) => m.id === currentMemberId)

  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-lg flex-col">
      {profileOpen && me && (
        <ProfileDialog
          member={me}
          appearance={appearance}
          storageError={storageError}
          onChange={setAppearance}
          onClose={() => setProfileOpen(false)}
          onSignOut={changeIdentity}
        />
      )}
      <header className="app-header sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3"><span className="brand-mark"><Icon name="journey" /></span><div className="min-w-0"><p className="eyebrow">GASTOS COMPARTIDOS</p><h1 className="truncate text-base font-bold text-slate-900">{snapshot?.group.name ?? 'Roadtrip'}</h1></div></div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-surface px-2.5 text-sm font-semibold text-slate-700 active:bg-accent-50"
          aria-label="Abrir perfil y apariencia"
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
        >
          {me ? (
            <>
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-[#1c3025]"
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

      {sync && (!sync.online || sync.pendingCount > 0 || sync.error) && (
        <div role="status" className="animate-rise bg-amber-500 px-4 py-1.5 text-center text-sm font-semibold text-amber-950">
          {sync.online && sync.error ? `No se pudo sincronizar: ${sync.error}` : sync.online
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

      <main className="flex-1 px-5 pb-32 pt-5">
        <Outlet />
      </main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-lg items-center gap-4 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <NavLink to="/" end className={tabClass}>
          <Icon name="wallet" />
          Balances
        </NavLink>
        <Link
          to="/expense/new"
          aria-label="Agregar gasto"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-600 text-3xl font-bold text-on-accent shadow-lg transition active:scale-95 active:bg-accent-700"
        >
          <Icon name="plus" />
        </Link>
        <NavLink to="/history" className={tabClass}>
          <Icon name="history" />
          Historial
        </NavLink>
      </nav>
    </div>
  )
}
