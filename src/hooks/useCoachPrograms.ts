import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export interface Program {
  id: string
  name: string
  description?: string
  environment: string
  coach_id: string
  specific_client_id?: string | number | null
  created_at: string
}

export function useCoachPrograms(includeCustom = false) {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPrograms = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      let query = supabase
        .from('programs')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })

      if (!includeCustom) {
        query = query.is('specific_client_id', null)
      }

      const { data, error } = await query
      
      if (error) throw error
      setPrograms(data || [])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, includeCustom])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  return { programs, loading, refetchPrograms: fetchPrograms }
}
