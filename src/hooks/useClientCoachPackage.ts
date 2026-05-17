import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Vue côté client du forfait en cours avec son coach.
 *
 * Source de vérité = tables `coach_packages` + `coach_package_sessions`.
 * On expose à la fois le total/used en SÉANCES (nouveau système) et en
 * HEURES (legacy `clients.coach_package_*_hours`) pour rester compatible
 * avec les usages existants du composant `CoachHoursCard`.
 */

export interface ClientCoachPackage {
  enabled: boolean // package_enabled flag du client (le coach a activé le forfait pour lui)
  hasActivePackage: boolean
  totalSessions: number | null
  usedSessions: number
  remainingSessions: number | null
  priceEur: number | null
  unitPriceEur: number | null
  purchasedAt: string | null

  // legacy hour fields (kept for backward-compat with CoachHoursCard)
  totalHours: number | null
  remainingHours: number | null

  coachName: string | null
  sessions: Array<{
    id: string
    session_date: string
    session_type: string
    duration_min: number
    notes: string | null
  }>
}

const toFiniteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const isMissingTableError = (err: any) => {
  if (!err) return false
  const code = String(err.code || '')
  const message = String(err.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('coach_packages') ||
    message.includes('coach_package_sessions')
  )
}

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
        // 1) Fetch client core info (coach + enabled flag)
        const { data: clientRow, error: clientError } = await supabase
          .from('clients')
          .select('coach_id, package_enabled, coach_package_total_hours, coach_package_used_hours')
          .eq('id', clientId)
          .single()

        if (clientError) throw clientError

        const coachId = clientRow?.coach_id ?? null
        const enabled = Boolean(clientRow?.package_enabled)
        const legacyTotalHours = toFiniteOrNull(clientRow?.coach_package_total_hours)
        const legacyUsedHours = toFiniteOrNull(clientRow?.coach_package_used_hours) ?? 0

        // 2) Coach name
        let coachName: string | null = null
        if (coachId) {
          const { data: coachRow } = await supabase
            .from('coaches')
            .select('full_name')
            .eq('id', coachId)
            .maybeSingle()
          coachName = coachRow?.full_name ?? null
        }

        // 3) Active package + its sessions (new system)
        let totalSessions: number | null = null
        let usedSessions = 0
        let priceEur: number | null = null
        let unitPriceEur: number | null = null
        let purchasedAt: string | null = null
        let sessions: ClientCoachPackage['sessions'] = []
        let hasActivePackage = false

        if (enabled) {
          const pkgRes = await supabase
            .from('coach_packages')
            .select('id, total_sessions, price_eur, unit_price_eur, purchased_at')
            .eq('client_id', clientId)
            .eq('status', 'active')
            .order('purchased_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (pkgRes.error) {
            if (isMissingTableError(pkgRes.error)) {
              if (!cancelled) setReady(false)
            } else {
              throw pkgRes.error
            }
          } else if (pkgRes.data) {
            hasActivePackage = true
            totalSessions = toFiniteOrNull(pkgRes.data.total_sessions)
            priceEur = toFiniteOrNull(pkgRes.data.price_eur)
            unitPriceEur = toFiniteOrNull(pkgRes.data.unit_price_eur)
            purchasedAt = pkgRes.data.purchased_at ?? null

            const sesRes = await supabase
              .from('coach_package_sessions')
              .select('id, session_date, session_type, duration_min, notes')
              .eq('package_id', pkgRes.data.id)
              .order('session_date', { ascending: false })

            if (!sesRes.error && Array.isArray(sesRes.data)) {
              sessions = sesRes.data as ClientCoachPackage['sessions']
              usedSessions = sessions.length
            }
          }
        }

        const remainingSessions =
          totalSessions != null ? Math.max(totalSessions - usedSessions, 0) : null

        if (!cancelled) {
          setData({
            enabled,
            hasActivePackage,
            totalSessions,
            usedSessions,
            remainingSessions,
            priceEur,
            unitPriceEur,
            purchasedAt,
            // legacy mirror for CoachHoursCard
            totalHours: hasActivePackage ? totalSessions : legacyTotalHours,
            remainingHours: hasActivePackage ? remainingSessions : (legacyTotalHours != null ? Math.max(legacyTotalHours - legacyUsedHours, 0) : null),
            coachName,
            sessions,
          })
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useClientCoachPackage]', err)
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
