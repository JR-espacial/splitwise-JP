import { useState } from 'react'
import { ProfileDialog } from './ProfileDialog'
import { useAppearance } from './appearance'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ledgerStore, useLedger } from '../data/store'
import { MemberAvatar } from './MemberAvatar'
import { DesignIcon } from './DesignIcon'
import { useIdentity } from './identityContext'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col gap-1 items-center justify-center rounded-2xl text-xs font-semibold transition-colors ${
    isActive ? 'text-accent-ink' : 'text-slate-500 active:bg-slate-100'
  }`

export function Layout() {
  const { pathname } = useLocation()
  const formPage = pathname === '/expense/new' || pathname.endsWith('/edit') || pathname === '/settlement/new'
  const pageTitle = pathname === '/settlement/new' ? 'Registrar pago' : pathname.endsWith('/edit') ? 'Editar gasto' : 'Nuevo gasto'
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
        <div className="flex min-w-0 items-center gap-2">
          {formPage && <Link to="/" aria-label="Volver a balances" className="header-back"><DesignIcon name="back" /></Link>}
          <img src="/design/logo.png" alt="" width="32" height="32" className="shrink-0" />
          <div className="min-w-0"><h1 className="truncate text-[17px] font-semibold">{formPage ? pageTitle : snapshot?.group.name ?? 'Viaje'}</h1><p className="eyebrow">{formPage ? snapshot?.group.name : 'GASTOS COMPARTIDOS'}</p></div>
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="profile-trigger"
          aria-label="Abrir perfil y apariencia"
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
        >
          {me ? (
            <MemberAvatar member={me} size={32} />
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

      <main className="app-main flex-1 px-4 pb-28 pt-3">
        <Outlet />
      </main>

      {!formPage && <nav className="bottom-nav fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-lg items-center gap-4 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <NavLink to="/" end className={tabClass}>
          <span aria-hidden="true" className="nav-tab-icon nav-tab-icon-wallet" />
          Balances
        </NavLink>
        <Link
          to="/expense/new"
          aria-label="Agregar gasto"
          className="nav-add flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-600 text-3xl font-bold text-on-accent shadow-lg transition active:scale-95 active:bg-accent-700"
        >
          <DesignIcon name="plus" />
        </Link>
        <NavLink to="/history" className={tabClass}>
          <span aria-hidden="true" className="nav-tab-icon nav-tab-icon-history" />
          Historial
        </NavLink>
      </nav>}
    </div>
  )
}
