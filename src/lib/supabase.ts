import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your_supabase_url_here') {
    console.warn(
      '⚠️ Supabase: Les variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ne sont pas configurées. Créez un fichier .env.local à la racine du projet.'
    )
    // Return a dummy client that won't actually work but won't crash the app
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()
