import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface ClientProfile {
  id: string
  auth_user_id: string
  email: string
  client_code: string
  full_name?: string
}

export function useClientProfile() {
  const { user } = useAuth()
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchClientProfile() {
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!error && data) {
        setClient(data)
      }
      setLoading(false)
    }

    fetchClientProfile()
  }, [user])

  return { client, loading }
}
