import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { getSupabase } from './supabaseClient'

export interface AuthState {
  loading: boolean
  session: Session | null
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw error
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/` },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut()
}

/** Session state; supabase-js persists it in localStorage so a previously
 *  signed-in device resolves offline too. */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, session: null })

  useEffect(() => {
    let supabase: SupabaseClient
    try {
      supabase = getSupabase()
    } catch {
      // Missing env config: surface as signed-out; the login attempt will
      // show the underlying error.
      setState({ loading: false, session: null })
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setState({ loading: false, session: data.session })
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, session })
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  return state
}
