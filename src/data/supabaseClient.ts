import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Lazy so a missing configuration surfaces as a catchable load error in the
 * UI instead of crashing the whole bundle at import time.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (copia .env.example a .env.local).',
    )
  }
  client = createClient(url, anonKey)
  return client
}
