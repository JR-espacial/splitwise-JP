import { useId, useRef, useState } from 'react'
import { DesignIcon } from './DesignIcon'

export function MovementMenu({ label, onDelete }: { label: string; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [open, setOpen] = useState(false)

  const showMenu = () => {
    const popup = dialog.current
    const button = trigger.current
    if (!popup || !button) return
    const bounds = button.getBoundingClientRect()
    popup.style.left = `${Math.max(8, Math.min(bounds.right - 156, window.innerWidth - 164))}px`
    popup.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - 72))}px`
    popup.showModal()
    setOpen(true)
  }

  return (
    <>
      <button ref={trigger} type="button" className="movement-menu-trigger" aria-label={`Opciones de ${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={showMenu}>
        <span aria-hidden="true">⋮</span>
      </button>
      <dialog ref={dialog} id={id} className="movement-menu" aria-label={`Opciones de ${label}`} onClose={() => setOpen(false)} onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}>
        <button type="button" onClick={() => {
          dialog.current?.close()
          onDelete()
        }}><DesignIcon name="delete" size={16} />Eliminar</button>
      </dialog>
    </>
  )
}
