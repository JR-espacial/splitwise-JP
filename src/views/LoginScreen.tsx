import { useState, type FormEvent } from 'react'
import { Icon } from '../ui/Icon'
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from '../data/auth'

export function LoginScreen() {
  const [googleBusy, setGoogleBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.has('error') || params.has('error_code')
      ? 'No se pudo completar el acceso. Intenta nuevamente.'
      : null
  })

  const handleGoogleSignIn = async () => {
    if (googleBusy || emailBusy) return
    setGoogleBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch {
      setGoogleBusy(false)
      setError('No se pudo abrir el acceso con Google. Revisa tu conexión e intenta de nuevo.')
    }
  }

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (googleBusy || emailBusy) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return

    setEmailBusy(true)
    setError(null)
    setSentTo(null)
    try {
      await sendEmailCode(normalizedEmail)
      setSentTo(normalizedEmail)
    } catch {
      setError('No se pudo enviar el código. Revisa el correo y tu conexión e intenta de nuevo.')
    } finally {
      setEmailBusy(false)
    }
  }

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sentTo || code.length !== 6 || googleBusy || emailBusy) return

    setEmailBusy(true)
    setError(null)
    try {
      await verifyEmailCode(sentTo, code)
    } catch {
      setError('El código no es válido o ya venció. Revísalo e intenta nuevamente.')
      setEmailBusy(false)
    }
  }

  return (
    <main className="login-shell mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-7 py-12">
      <div className="text-center">
        <span className="brand-mark login-mark"><Icon name="journey" /></span>
        <p className="eyebrow mb-3">MENOS CUENTAS, MÁS AVENTURAS</p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Europa 2026</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Elige cómo quieres entrar y sigue con la aventura.
        </p>
      </div>
      <div className="login-card flex flex-col gap-4">
        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={googleBusy || emailBusy}
          className="flex min-h-12 items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-6 py-3 text-sm font-medium text-[#1f1f1f] transition hover:bg-slate-50 disabled:opacity-60"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
          {googleBusy ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">o</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        {!sentTo ? <form className="flex flex-col gap-3" onSubmit={(event) => void handleSendCode(event)}>
          <label htmlFor="login-email" className="text-sm font-semibold text-slate-700">
            Correo electrónico
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
            placeholder="tu@correo.com"
            className="min-h-12 rounded-2xl border border-slate-200 bg-surface px-4 text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={googleBusy || emailBusy || !email.trim()}
            className="min-h-12 rounded-2xl bg-accent-600 px-5 py-3 text-sm font-bold text-on-accent transition active:scale-[0.98] active:bg-accent-700 disabled:opacity-55"
          >
            {emailBusy ? 'Enviando código…' : 'Enviarme un código'}
          </button>
        </form> : (
          <form className="flex flex-col gap-3" onSubmit={(event) => void handleVerifyCode(event)}>
            <p role="status" className="rounded-2xl bg-accent-50 px-4 py-3 text-sm leading-relaxed text-accent-ink">
              Enviamos un código de 6 dígitos a <strong>{sentTo}</strong>.
            </p>
            <label htmlFor="login-code" className="text-sm font-semibold text-slate-700">
              Código de acceso
            </label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              aria-describedby="code-help"
              className="min-h-14 rounded-2xl border border-slate-200 bg-surface px-4 text-center text-2xl font-semibold tracking-[0.35em] text-slate-900 placeholder:text-slate-300"
            />
            <p id="code-help" className="text-xs leading-relaxed text-slate-500">
              Regresa a esta app después de consultar tu correo e introduce el código aquí.
            </p>
            <button
              type="submit"
              disabled={googleBusy || emailBusy || code.length !== 6}
              className="min-h-12 rounded-2xl bg-accent-600 px-5 py-3 text-sm font-bold text-on-accent transition active:scale-[0.98] active:bg-accent-700 disabled:opacity-55"
            >
              {emailBusy ? 'Verificando…' : 'Entrar con el código'}
            </button>
            <button
              type="button"
              disabled={emailBusy}
              onClick={() => {
                setSentTo(null)
                setCode('')
                setError(null)
              }}
              className="min-h-10 text-sm font-semibold text-accent-ink"
            >
              Cambiar correo
            </button>
          </form>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <p className="text-center text-xs leading-relaxed text-slate-500">
          Usa el correo registrado para el viaje. Solo los integrantes pueden acceder al grupo.
        </p>
      </div>
      <p className="text-center text-xs text-slate-500">Un viaje juntos. Las cuentas, en un solo lugar.</p>
      <a href="/privacy.html" className="text-center text-xs text-slate-500 underline">Privacidad</a>
    </main>
  )
}
