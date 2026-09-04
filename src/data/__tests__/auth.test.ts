import { afterEach, describe, expect, it, vi } from 'vitest'
import { signInWithGoogle } from '../auth'

const { oauth } = vi.hoisted(() => ({ oauth: vi.fn() }))
vi.mock('../supabaseClient', () => ({
  getSupabase: () => ({ auth: { signInWithOAuth: oauth } }),
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
