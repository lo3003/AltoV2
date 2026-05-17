import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type PackageStatus = 'active' | 'finished' | 'cancelled'

export interface CoachPackage {
  id: string
  client_id: string | number
  coach_id: string
  total_sessions: number
  price_eur: number
  unit_price_eur: number
  status: PackageStatus
  purchased_at: string // YYYY-MM-DD
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CoachPackageSession {
  id: string
  package_id: string
  client_id: string | number
  coach_id: string
  session_date: string // YYYY-MM-DD
  session_type: string
  duration_min: number
  notes: string | null
  created_at: string
}

export interface PackagePricePreset {
  sessions: number
  price: number
}

export interface CreatePackageInput {
  totalSessions: number
  priceEur: number
  purchasedAt: string // YYYY-MM-DD
  notes?: string | null
}

export interface AddPackageSessionInput {
  packageId: string
  sessionDate: string // YYYY-MM-DD
  sessionType: string
  durationMin?: number
  notes?: string | null
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const normalizeClientId = (value: string | number) => {
  if (typeof value === 'number') return value
  return /^\d+$/.test(value) ? Number(value) : value
}

const DEFAULT_PRESETS: PackagePricePreset[] = [
  { sessions: 1, price: 25 },
  { sessions: 5, price: 120 },
  { sessions: 10, price: 225 },
]

/* -------------------------------------------------------------------------- */
/*  useCoachPackages — gestion des forfaits pour UN client (coté coach)        */
/* -------------------------------------------------------------------------- */

interface UseCoachPackagesReturn {
  loading: boolean
  saving: boolean
  error: string | null

  activePackage: CoachPackage | null
  pastPackages: CoachPackage[]
  sessions: CoachPackageSession[]
  remainingSessions: number | null // null si pas de forfait actif

  pricePresets: PackagePricePreset[]

  // mutations
  createPackage: (input: CreatePackageInput) => Promise<CoachPackage>
  cancelPackage: (packageId: string) => Promise<void>
  addSession: (input: AddPackageSessionInput) => Promise<CoachPackageSession>
  removeSession: (sessionId: string) => Promise<void>

  refetch: () => Promise<void>
}

export function useCoachPackages(clientId?: string | number | null): UseCoachPackagesReturn {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packages, setPackages] = useState<CoachPackage[]>([])
  const [sessions, setSessions] = useState<CoachPackageSession[]>([])
  const [pricePresets, setPricePresets] = useState<PackagePricePreset[]>(DEFAULT_PRESETS)

  const fetchData = useCallback(async () => {
    if (!user || !clientId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const normalizedClientId = normalizeClientId(clientId)

      const [pkgRes, sesRes, coachRes] = await Promise.all([
        supabase
          .from('coach_packages')
          .select('*')
          .eq('client_id', normalizedClientId)
          .eq('coach_id', user.id)
          .order('purchased_at', { ascending: false }),
        supabase
          .from('coach_package_sessions')
          .select('*')
          .eq('client_id', normalizedClientId)
          .eq('coach_id', user.id)
          .order('session_date', { ascending: false }),
        supabase
          .from('coaches')
          .select('package_pricing')
          .eq('id', user.id)
          .maybeSingle(),
      ])

      if (pkgRes.error) throw pkgRes.error
      if (sesRes.error) throw sesRes.error

      setPackages((pkgRes.data ?? []) as CoachPackage[])
      setSessions((sesRes.data ?? []) as CoachPackageSession[])

      const presets = coachRes.data?.package_pricing
      if (Array.isArray(presets) && presets.length > 0) {
        setPricePresets(presets as PackagePricePreset[])
      } else {
        setPricePresets(DEFAULT_PRESETS)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des forfaits'
      setError(message)
      console.error('[useCoachPackages]', err)
    } finally {
      setLoading(false)
    }
  }, [clientId, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const activePackage = packages.find((p) => p.status === 'active') ?? null
  const pastPackages = packages.filter((p) => p.status !== 'active')

  // Sessions linked to the active package (used to compute remaining)
  const activeSessionsCount = activePackage
    ? sessions.filter((s) => s.package_id === activePackage.id).length
    : 0
  const remainingSessions = activePackage
    ? Math.max(activePackage.total_sessions - activeSessionsCount, 0)
    : null

  const createPackage = useCallback(
    async (input: CreatePackageInput): Promise<CoachPackage> => {
      if (!user || !clientId) throw new Error('Coach ou client introuvable.')
      setSaving(true)
      try {
        const { data, error: insertError } = await supabase
          .from('coach_packages')
          .insert({
            client_id: normalizeClientId(clientId),
            coach_id: user.id,
            total_sessions: input.totalSessions,
            price_eur: input.priceEur,
            purchased_at: input.purchasedAt,
            notes: input.notes?.trim() || null,
            status: 'active',
          })
          .select('*')
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(
              'Ce client a déjà un forfait actif. Termine-le ou annule-le avant d’en créer un nouveau.'
            )
          }
          throw insertError
        }

        const created = data as CoachPackage
        setPackages((prev) => [created, ...prev])
        return created
      } finally {
        setSaving(false)
      }
    },
    [clientId, user]
  )

  const cancelPackage = useCallback(
    async (packageId: string) => {
      if (!user) throw new Error('Coach non connecté.')
      setSaving(true)
      try {
        const { error: updError } = await supabase
          .from('coach_packages')
          .update({ status: 'cancelled' })
          .eq('id', packageId)
          .eq('coach_id', user.id)
        if (updError) throw updError
        setPackages((prev) =>
          prev.map((p) => (p.id === packageId ? { ...p, status: 'cancelled' } : p))
        )
      } finally {
        setSaving(false)
      }
    },
    [user]
  )

  const addSession = useCallback(
    async (input: AddPackageSessionInput): Promise<CoachPackageSession> => {
      if (!user || !clientId) throw new Error('Coach ou client introuvable.')
      setSaving(true)
      try {
        const { data, error: insertError } = await supabase
          .from('coach_package_sessions')
          .insert({
            package_id: input.packageId,
            client_id: normalizeClientId(clientId),
            coach_id: user.id,
            session_date: input.sessionDate,
            session_type: input.sessionType,
            duration_min: input.durationMin ?? 60,
            notes: input.notes?.trim() || null,
          })
          .select('*')
          .single()
        if (insertError) throw insertError

        const created = data as CoachPackageSession
        setSessions((prev) => [created, ...prev])
        // Trigger SQL may have auto-finished the package — refetch to get latest status.
        fetchData()
        return created
      } finally {
        setSaving(false)
      }
    },
    [clientId, user, fetchData]
  )

  const removeSession = useCallback(
    async (sessionId: string) => {
      if (!user) throw new Error('Coach non connecté.')
      setSaving(true)
      try {
        const { error: delError } = await supabase
          .from('coach_package_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('coach_id', user.id)
        if (delError) throw delError
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        // Trigger may have re-opened the package — refetch.
        fetchData()
      } finally {
        setSaving(false)
      }
    },
    [user, fetchData]
  )

  return {
    loading,
    saving,
    error,
    activePackage,
    pastPackages,
    sessions,
    remainingSessions,
    pricePresets,
    createPackage,
    cancelPackage,
    addSession,
    removeSession,
    refetch: fetchData,
  }
}

/* -------------------------------------------------------------------------- */
/*  togglePackageEnabled — flag on/off du système pour un client donné         */
/* -------------------------------------------------------------------------- */

export async function setClientPackageEnabled(clientId: string | number, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ package_enabled: enabled })
    .eq('id', normalizeClientId(clientId))
  if (error) throw error
}
