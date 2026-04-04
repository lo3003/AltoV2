import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AuthUser, UserRole } from '@/types/auth'

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  activateClient: (clientCode: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const isNoRowError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false

  const code = String((error as { code?: string }).code || '')
  const details = String((error as { details?: string }).details || '').toLowerCase()

  return code === 'PGRST116' || details.includes('0 rows')
}

async function determineRole(userId: string): Promise<{ role: UserRole; fullName?: string; clientCode?: string } | null> {
  // Check clients table first
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, auth_user_id, email, client_code')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (clientError && !isNoRowError(clientError)) {
    throw clientError
  }

  if (client) {
    return { role: 'client', clientCode: client.client_code }
  }

  // Check coaches table
  const { data: coach, error: coachError } = await supabase
    .from('coaches')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (coachError && !isNoRowError(coachError)) {
    throw coachError
  }

  if (coach) {
    return { role: 'coach', fullName: coach.full_name }
  }

  return null
}

function buildAuthUser(supaUser: User, roleInfo: { role: UserRole; fullName?: string; clientCode?: string }): AuthUser {
  return {
    id: supaUser.id,
    email: supaUser.email || '',
    role: roleInfo.role,
    fullName: roleInfo.fullName,
    clientCode: roleInfo.clientCode,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const resolveUser = useCallback(async (supaUser: User | null, currentSession: Session | null) => {
    if (!supaUser) {
      setUser(null)
      setSession(null)
      setLoading(false)
      return
    }

    setSession(currentSession)

    let roleInfo: { role: UserRole; fullName?: string; clientCode?: string } | null = null
    try {
      roleInfo = await determineRole(supaUser.id)
    } catch (err) {
      console.error('Erreur lors de la résolution du rôle utilisateur:', err)
      setUser(null)
      setLoading(false)
      return
    }

    if (!roleInfo) {
      // User exists in auth but not in coaches or clients tables
      setUser(null)
      setLoading(false)
      return
    }

    setUser(buildAuthUser(supaUser, roleInfo))
    setLoading(false)
  }, [])

  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      resolveUser(currentSession?.user ?? null, currentSession)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      resolveUser(currentSession?.user ?? null, currentSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [resolveUser])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }
  }

  const activateClient = async (clientCode: string, password: string) => {
    // 1. Find the client by code
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, auth_user_id, client_code')
      .eq('client_code', clientCode)
      .single()

    if (clientError || !client) {
      throw new Error('Code client invalide. Veuillez vérifier votre code.')
    }

    // 2. Check if already activated
    if (client.auth_user_id) {
      throw new Error('Ce compte client est déjà activé. Utilisez la connexion classique.')
    }

    if (!client.email) {
      throw new Error('Aucun email associé à ce code client. Contactez votre coach.')
    }

    // 3. Create the auth account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: client.email,
      password,
    })

    if (signUpError) {
      throw new Error(`Erreur lors de la création du compte : ${signUpError.message}`)
    }

    if (!signUpData.user) {
      throw new Error('Erreur inattendue lors de la création du compte.')
    }

    // 4. Update the client row with the new auth_user_id
    const { error: updateError } = await supabase
      .from('clients')
      .update({ auth_user_id: signUpData.user.id })
      .eq('id', client.id)

    if (updateError) {
      throw new Error(`Erreur lors de la liaison du compte : ${updateError.message}`)
    }
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, login, activateClient, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
