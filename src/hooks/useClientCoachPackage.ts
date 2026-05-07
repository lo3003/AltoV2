import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ClientCoachPackage {
  totalHours: number | null
  usedHours: number
  remainingHours: number | null
  coachName: string | null
}

const isMissingColumnError = (err: any) => {
  if (!err) return false
  const code = String(err.code || '')
  const message = String(err.message || '').toLowerCase()
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('coach_package_total_hours') ||
    message.includes('coach_package_used_hours')
  )
}

const toFiniteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Fetches the client's coach-package state (total / used hours) and the coach's name.
 * Returns nulls + ready=false if the migration hasn't been applied yet.
 */
export function useClientCoachPackage(clientId?: string | number | null) {
  const [data, setData] = useState<ClientCoachPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchPackage() {
      if (!clientId) {
        setLoading(false)
        setData(null)
        return
      }

      setLoading(true)

      try {
        // Try the full query first (with package columns)
        let result = await supabase
          .from('clients')
          .select('coach_id, coach_package_total_hours, coach_package_used_hours')
          .eq('id', clientId)
          .single()

        let total: number | null = null
        let used = 0
        let coachId: string | number | null = null

        if (result.error) {
          if (isMissingColumnError(result.error)) {
            // Migration not applied: fall back to coach_id only
            const fallback = await supabase
              .from('clients')
              .select('coach_id')
              .eq('id', clientId)
              .single()

            if (fallback.error) throw fallback.error
            coachId = fallback.data?.coach_id ?? null
            if (!cancelled) setReady(false)
          } else {
            throw result.error
          }
        } else {
          coachId = result.data?.coach_id ?? null
          total = toFiniteOrNull(result.data?.coach_package_total_hours)
          used = toFiniteOrNull(result.data?.coach_package_used_hours) ?? 0
          if (!cancelled) setReady(true)
        }

        let coachName: string | null = null
        if (coachId) {
          const { data: coachRow } = await supabase
            .from('coaches')
            .select('full_name')
            .eq('id', coachId)
            .maybeSingle()
          coachName = coachRow?.full_name ?? null
        }

        if (!cancelled) {
          setData({
            totalHours: total,
            usedHours: used,
            remainingHours: total != null ? Math.max(total - used, 0) : null,
            coachName,
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching coach package:', err)
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPackage()

    return () => {
      cancelled = true
    }
  }, [clientId])

  return { data, loading, ready }
}
