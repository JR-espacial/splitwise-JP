import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { signInWithGoogle } from '../data/auth'

export function LoginScreen() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.has('error') || params.has('error_code')
      ? 'No se pudo completar el acceso. Intenta de nuevo con tu cuenta de Google.'
      : null
  })

  const handleSignIn = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch {
      setBusy(false)
      setError('No se pudo abrir el acceso con Google. Revisa tu conexión e intenta de nuevo.')
    }
  }

  return (
    <main className="login-shell mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-7 py-12">
      <div className="text-center">
        <span className="brand-mark login-mark"><Icon name="journey" /></span>
        <p className="eyebrow mb-3">MENOS CUENTAS, MÁS AVENTURAS</p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Europa 2026</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Entra con tu cuenta de Google y sigue con la aventura.
        </p>
      </div>
      <div className="login-card flex flex-col gap-4">
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={busy}
          className="flex min-h-12 items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-6 py-3 text-sm font-medium text-[#1f1f1f] transition hover:bg-slate-50 disabled:opacity-60"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
          {busy ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>
        <p className="text-center text-sm leading-relaxed text-slate-500">
          Usa el correo que registraste para el viaje. Solo los integrantes pueden acceder al grupo.
        </p>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </div>
      <p className="text-center text-xs text-slate-500">Un viaje juntos. Las cuentas, en un solo lugar.</p>
      <a href="/privacy.html" className="text-center text-xs text-slate-500 underline">Privacidad</a>
    </main>
  )
}
