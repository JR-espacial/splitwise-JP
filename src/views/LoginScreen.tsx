import { useState } from 'react'
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Roadtrip Europa 2026</h1>
        <p className="mt-2 text-slate-600">
          Entra con tu correo: te enviamos un enlace mágico, sin contraseña.
        </p>
      </div>

      {phase === 'sent' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
          <p className="font-semibold text-emerald-900">Revisa tu correo 📬</p>
          <p className="mt-1 text-sm text-emerald-800">
            Enviamos un enlace a <span className="font-semibold">{email.trim()}</span>. Ábrelo en
            este mismo dispositivo.
          </p>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
          >
            Usar otro correo
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
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
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900"
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!email.trim().includes('@') || phase === 'sending'}
            className="min-h-14 rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md transition active:scale-[0.98] active:bg-emerald-700 disabled:bg-slate-300"
          >
            {phase === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
    </main>
  )
}
