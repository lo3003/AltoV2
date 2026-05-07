import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ClientCoachInfo {
  id: string | number
  fullName: string | null
  email: string | null
  phone: string | null
  bio: string | null
}

const isMissingColumnError = (err: any) => {
  if (!err) return false
  const code = String(err.code || '')
  const message = String(err.message || '').toLowerCase()
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('phone') ||
    message.includes('email') ||
    message.includes('bio')
  )
}

/**
 * Returns the coach contact information for the given client.
 * Falls back gracefully if the contact-info migration hasn't been applied yet.
 */
export function useClientCoachInfo(clientId?: string | number | null) {
  const [coach, setCoach] = useState<ClientCoachInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchCoach() {
      if (!clientId) {
        setLoading(false)
        setCoach(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data: clientRow, error: clientError } = await supabase
          .from('clients')
          .select('coach_id')
          .eq('id', clientId)
          .maybeSingle()

        if (clientError) throw clientError

        const coachId = clientRow?.coach_id ?? null
        if (!coachId) {
          if (!cancelled) setCoach(null)
          return
        }

        // Try to load all contact fields, fallback to minimal if columns missing
        let coachData: any = null
        const fullQuery = await supabase
          .from('coaches')
          .select('id, full_name, email, phone, bio')
          .eq('id', coachId)
          .maybeSingle()

        if (fullQuery.error) {
          if (isMissingColumnError(fullQuery.error)) {
            const minimal = await supabase
              .from('coaches')
              .select('id, full_name')
              .eq('id', coachId)
              .maybeSingle()
            if (minimal.error) throw minimal.error
            coachData = minimal.data
          } else {
            throw fullQuery.error
          }
        } else {
          coachData = fullQuery.data
        }

        if (!coachData) {
          if (!cancelled) setCoach(null)
          return
        }

        if (!cancelled) {
          setCoach({
            id: coachData.id,
            fullName: coachData.full_name ?? null,
            email: coachData.email ?? null,
            phone: coachData.phone ?? null,
            bio: coachData.bio ?? null,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Impossible de charger les infos coach.'
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCoach()

    return () => {
      cancelled = true
    }
  }, [clientId])

  return { coach, loading, error }
}
