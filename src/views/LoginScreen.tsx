import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { sendMagicLink } from '../data/auth'

type Phase = 'idle' | 'sending' | 'sent'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const trimmed = email.trim()
    if (!trimmed.includes('@') || phase === 'sending') return
    setPhase('sending')
    setError(null)
    try {
      await sendMagicLink(trimmed)
      setPhase('sent')
    } catch (cause) {
      setPhase('idle')
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar el enlace')
    }
  }

  return (
    <main className="login-shell mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-7 py-12">
      <div className="text-center"><span className="brand-mark login-mark"><Icon name="journey" /></span><p className="eyebrow mb-3">MENOS CUENTAS, MÁS AVENTURAS</p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Roadtrip Europa 2026</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Entra con tu correo: te enviamos un enlace mágico, sin contraseña.
        </p>
      </div>

      {phase === 'sent' ? (
        <div className="rounded-2xl border border-accent-200 bg-accent-50 px-5 py-6 text-center">
          <p className="font-semibold text-accent-ink">Revisa tu correo 📬</p>
          <p className="mt-1 text-sm text-accent-ink">
            Enviamos un enlace a <span className="font-semibold">{email.trim()}</span>. Ábrelo en
            este mismo dispositivo.
          </p>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-accent-ink active:bg-accent-100"
          >
            Usar otro correo
          </button>
        </div>
      ) : (
        <form
          className="login-card flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">
            Correo
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-surface px-4 text-slate-900"
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!email.trim().includes('@') || phase === 'sending'}
            className="min-h-14 rounded-2xl bg-accent-600 text-lg font-bold text-on-accent shadow-md transition active:scale-[0.98] active:bg-accent-700 disabled:bg-slate-300 disabled:text-slate-600"
          >
            {phase === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
      <p className="text-center text-xs text-slate-500">Un viaje juntos. Las cuentas, en un solo lugar.</p>
    </main>
  )
}
