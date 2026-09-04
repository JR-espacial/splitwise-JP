import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendMagicLink, signInWithGoogle } from '../auth'

const { oauth, otp } = vi.hoisted(() => ({ oauth: vi.fn(), otp: vi.fn() }))
vi.mock('../supabaseClient', () => ({
  getSupabase: () => ({ auth: { signInWithOAuth: oauth, signInWithOtp: otp } }),
}))
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

describe('Google sign-in', () => {
  it('returns to the hosted app root even when login starts on a nested route', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://splitwise-jp.vercel.app', pathname: '/history' } })
    oauth.mockResolvedValue({ error: null })
    await signInWithGoogle()
    expect(oauth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://splitwise-jp.vercel.app/',
        queryParams: { prompt: 'select_account' },
      },
    })
  })
  it('reports a provider failure so the screen can allow another attempt', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://splitwise-jp.vercel.app' } })
    const error = new Error('Provider unavailable')
    oauth.mockResolvedValue({ error })
    await expect(signInWithGoogle()).rejects.toBe(error)
  })
})

describe('Magic-link sign-in', () => {
  it('normalizes the email and returns to the hosted app root', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://splitwise-jp.vercel.app' } })
    otp.mockResolvedValue({ error: null })
    await sendMagicLink('  Paulina@Example.com ')
    expect(otp).toHaveBeenCalledWith({
      email: 'paulina@example.com',
      options: { emailRedirectTo: 'https://splitwise-jp.vercel.app/' },
    })
  })

  it('reports an email provider failure', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://splitwise-jp.vercel.app' } })
    const error = new Error('Email unavailable')
    otp.mockResolvedValue({ error })
    await expect(sendMagicLink('paulina@example.com')).rejects.toBe(error)
  })
})
