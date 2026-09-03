import { useEffect, useRef } from 'react'
import type { Member } from '../domain/types'
import { THEME_COLORS, type Appearance } from './appearance'
import { Icon } from './Icon'
import { MemberAvatar } from './MemberAvatar'

interface ProfileDialogProps {
  member: Member
  appearance: Appearance
  storageError: boolean
  onChange: (appearance: Appearance) => void
  onClose: () => void
  onSignOut: () => void
}

export function ProfileDialog({ member, appearance, storageError, onChange, onClose, onSignOut }: ProfileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current!
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="profile-title"
      className="profile-dialog"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="profile-title" className="text-xl font-bold">Tu perfil</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar perfil" className="profile-close">
          <Icon name="close" />
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <MemberAvatar member={member} size={48} />
        <div className="min-w-0">
          <p className="font-bold">{member.name}</p>
          {member.email && <p className="break-all text-sm text-slate-500">{member.email}</p>}
        </div>
      </div>

      <fieldset>
        <legend className="font-semibold">Color de la app</legend>
        <p className="mb-4 mt-1 text-sm text-slate-500">Dale tu toque al viaje.</p>
        <div className="grid grid-cols-5 gap-1">
          {THEME_COLORS.map((color) => (
            <label key={color.id} className="theme-option">
              <input
                className="sr-only"
                type="radio"
                name="theme-color"
                value={color.id}
                checked={appearance.color === color.id}
                onChange={() => onChange({ ...appearance, color: color.id })}
              />
              <span className="theme-swatch" style={{ background: color.swatch }}>
                {appearance.color === color.id && <Icon name="check" />}
              </span>
              <span className="text-xs font-semibold">{color.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="my-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Icon name={appearance.mode === 'dark' ? 'moon' : 'sun'} />
          <div>
            <p id="dark-mode-label" className="font-semibold">Modo oscuro</p>
            <p className="text-xs text-slate-500">{appearance.mode === 'dark' ? 'Activado' : 'Desactivado · modo claro'}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={appearance.mode === 'dark'}
          aria-labelledby="dark-mode-label"
          className="mode-switch"
          onClick={() => onChange({ ...appearance, mode: appearance.mode === 'dark' ? 'light' : 'dark' })}
        >
          <span />
        </button>
      </div>

      <p className="text-xs leading-relaxed text-slate-500" role="status">
        {storageError ? 'El cambio está aplicado, pero no se pudo guardar en este dispositivo.' : 'Tus preferencias se guardan automáticamente para tu perfil en este dispositivo.'}
      </p>
      <div className="mt-6 border-t border-slate-200 pt-4">
        <button type="button" onClick={onSignOut} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-danger hover:bg-danger-soft">
          <Icon name="logout" /> Cerrar sesión
        </button>
      </div>
    </dialog>
  )
}
