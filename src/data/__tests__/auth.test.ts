import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from '../auth'

const { oauth, otp, verifyOtp } = vi.hoisted(() => ({ oauth: vi.fn(), otp: vi.fn(), verifyOtp: vi.fn() }))
vi.mock('../supabaseClient', () => ({
  getSupabase: () => ({ auth: { signInWithOAuth: oauth, signInWithOtp: otp, verifyOtp } }),
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

describe('Email-code sign-in', () => {
  it('normalizes the email when requesting a code', async () => {
    otp.mockResolvedValue({ error: null })
    await sendEmailCode('  Paulina@Example.com ')
    expect(otp).toHaveBeenCalledWith({
      email: 'paulina@example.com',
    })
  })

  it('reports an email provider failure', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://splitwise-jp.vercel.app' } })
    const error = new Error('Email unavailable')
    otp.mockResolvedValue({ error })
    await expect(sendEmailCode('paulina@example.com')).rejects.toBe(error)
  })

  it('verifies the code inside the current app context', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await verifyEmailCode(' Paulina@Example.com ', ' 123456 ')
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'paulina@example.com',
      token: '123456',
      type: 'email',
    })
  })

  it('reports an invalid or expired code', async () => {
    const error = new Error('Token expired')
    verifyOtp.mockResolvedValue({ error })
    await expect(verifyEmailCode('paulina@example.com', '123456')).rejects.toBe(error)
  })
})
