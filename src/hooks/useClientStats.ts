import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkoutLog } from '@/hooks/useClientDashboard'

export interface ClientWeightLog {
  id: string | number
  client_id: string | number
  weight_kg: number
  measured_at: string
  note?: string | null
}

interface ClientWeightLogRow {
  id: string | number
  client_id: string | number
  weight_kg: number | string
  measured_at: string
  note?: string | null
}

interface WorkoutLogRow {
  id: string | number
  client_id: string | number
  program_id?: string | number | null
  completed_at: string
  programs?: { name: string } | Array<{ name: string }> | null
}

interface WeeklyWeightPoint {
  weekLabel: string
  weekStart: string
  weightKg: number
  deltaKg: number | null
}

interface WeeklySessionPoint {
  weekLabel: string
  weekStart: string
  count: number
}

export interface ExternalSessionPayload {
  name: string
  category: string
  durationMinutes: number
  completedAt: string // ISO datetime
}

interface ClientStatsData {
  loading: boolean
  savingWeight: boolean
  savingSession: boolean
  error: string | null
  tableReady: boolean
  weightLogs: ClientWeightLog[]
  weeklyWeightPoints: WeeklyWeightPoint[]
  weeklySessionPoints: WeeklySessionPoint[]
  thisWeekSessions: number
  thisMonthSessions: number
  latestProgramTitle: string | null
  addWeightLog: (payload: { weightKg: number; measuredAt: string }) => Promise<void>
  addExternalSession: (payload: ExternalSessionPayload) => Promise<void>
  refetch: () => Promise<void>
}

const normalizeId = (value: string | number) => {
  if (typeof value === 'number') return value
  return /^\d+$/.test(value) ? Number(value) : value
}

const isMissingTableError = (error: any, tableName: string) => {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()

  if (code === '42P01' || code === 'PGRST205') return true
  return message.includes(tableName.toLowerCase()) && (message.includes('does not exist') || message.includes('could not find'))
}

const parseWeight = (value: number | string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getWeekStart = (date: Date) => {
  const localDate = new Date(date)
  const day = localDate.getDay()
  const mondayShift = day === 0 ? -6 : 1 - day
  localDate.setDate(localDate.getDate() + mondayShift)
  localDate.setHours(0, 0, 0, 0)
  return localDate
}

const formatWeekLabel = (weekStart: Date) => {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)

  return `${weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
}

export function useClientStats(clientId?: string | number | null): ClientStatsData {
  const [loading, setLoading] = useState(true)
  const [savingWeight, setSavingWeight] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [tableReady, setTableReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weightLogs, setWeightLogs] = useState<ClientWeightLog[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [initialWeightKg, setInitialWeightKg] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      setError(null)
      setWeightLogs([])
      setWorkoutLogs([])
      setInitialWeightKg(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const normalizedClientId = normalizeId(clientId)

      const [{ data: clientData, error: clientError }, { data: logsData, error: logsError }] = await Promise.all([
        supabase
          .from('clients')
          .select('initial_weight_kg')
          .eq('id', normalizedClientId)
          .single(),
        supabase
          .from('workout_logs')
          .select('id, client_id, program_id, completed_at, programs(name)')
          .eq('client_id', normalizedClientId)
          .order('completed_at', { ascending: false }),
      ])

      if (clientError) throw clientError
      if (logsError) throw logsError

      setInitialWeightKg(clientData?.initial_weight_kg != null ? Number(clientData.initial_weight_kg) : null)

      const mappedWorkoutLogs = ((logsData || []) as WorkoutLogRow[]).map((row) => {
        const relatedProgram = Array.isArray(row.programs) ? row.programs[0] : row.programs

        return {
          id: String(row.id),
          client_id: String(row.client_id),
          program_id: row.program_id != null ? String(row.program_id) : undefined,
          completed_at: row.completed_at,
          programs: relatedProgram?.name ? { name: relatedProgram.name } : undefined,
        } as WorkoutLog
      })

      setWorkoutLogs(mappedWorkoutLogs)

      const { data: weightData, error: weightError } = await supabase
        .from('client_weight_logs')
        .select('id, client_id, weight_kg, measured_at, note')
        .eq('client_id', normalizedClientId)
        .order('measured_at', { ascending: true })

      if (weightError) {
        if (isMissingTableError(weightError, 'client_weight_logs')) {
          setTableReady(false)
          setWeightLogs([])
          return
        }
        throw weightError
      }

      const mapped = ((weightData || []) as ClientWeightLogRow[]).map((row) => ({
        id: row.id,
        client_id: row.client_id,
        measured_at: row.measured_at,
        weight_kg: parseWeight(row.weight_kg),
        note: row.note,
      }))

      setWeightLogs(mapped)
      setTableReady(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des statistiques.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addWeightLog = useCallback(async (payload: { weightKg: number; measuredAt: string }) => {
    if (!clientId) throw new Error('Client introuvable.')

    setSavingWeight(true)
    try {
      const { data, error: insertError } = await supabase
        .from('client_weight_logs')
        .upsert(
          {
            client_id: normalizeId(clientId),
            weight_kg: payload.weightKg,
            measured_at: payload.measuredAt,
          },
          {
            onConflict: 'client_id,measured_at',
            ignoreDuplicates: false,
          }
        )
        .select('id, client_id, weight_kg, measured_at, note')

      if (insertError) {
        if (isMissingTableError(insertError, 'client_weight_logs')) {
          setTableReady(false)
          throw new Error('La table client_weight_logs est absente. Exécutez la migration SQL dédiée.')
        }
        throw insertError
      }

      if (data && data.length > 0) {
        const nextLog = (data as ClientWeightLogRow[]).map((row) => ({
          id: row.id,
          client_id: row.client_id,
          measured_at: row.measured_at,
          weight_kg: parseWeight(row.weight_kg),
          note: row.note,
        }))[0]

        setWeightLogs((prev) => {
          const withoutSameDate = prev.filter((entry) => entry.measured_at !== nextLog.measured_at)
          return [...withoutSameDate, nextLog].sort((left, right) => left.measured_at.localeCompare(right.measured_at))
        })
      }

      setTableReady(true)
    } finally {
      setSavingWeight(false)
    }
  }, [clientId])

  const addExternalSession = useCallback(async (payload: ExternalSessionPayload) => {
    if (!clientId) throw new Error('Client introuvable.')
    if (!payload.name?.trim()) throw new Error('Le nom de la séance est requis.')
    if (!payload.completedAt) throw new Error('La date de la séance est requise.')
    if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) {
      throw new Error('La durée doit être un nombre positif.')
    }

    setSavingSession(true)
    try {
      const baseRow: Record<string, unknown> = {
        client_id: normalizeId(clientId),
        program_id: null,
        completed_at: payload.completedAt,
        duration_minutes: Math.round(payload.durationMinutes),
        session_type: 'external',
        external_name: payload.name.trim(),
        external_category: payload.category || null,
      }

      let { error: insertError } = await supabase.from('workout_logs').insert(baseRow)

      // Graceful fallback if migration hasn't been applied yet
      if (insertError) {
        const message = String(insertError.message || '').toLowerCase()
        const code = String(insertError.code || '')
        const missingColumn =
          code === 'PGRST204' ||
          message.includes('session_type') ||
          message.includes('external_name') ||
          message.includes('external_category')

        if (missingColumn) {
          const { session_type, external_name, external_category, ...legacyRow } = baseRow
          const fallback = await supabase.from('workout_logs').insert(legacyRow)
          insertError = fallback.error
        }
      }

      if (insertError) throw insertError

      // Refetch logs so stats update
      await fetchData()
    } finally {
      setSavingSession(false)
    }
  }, [clientId, fetchData])

  const thisWeekSessions = useMemo(() => {
    const now = new Date()
    const weekStart = getWeekStart(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    return workoutLogs.filter((log) => {
      const date = new Date(log.completed_at)
      return date >= weekStart && date <= weekEnd
    }).length
  }, [workoutLogs])

  const thisMonthSessions = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    return workoutLogs.filter((log) => {
      const date = new Date(log.completed_at)
      return date >= monthStart && date <= monthEnd
    }).length
  }, [workoutLogs])

  const latestProgramTitle = useMemo(() => {
    const latest = workoutLogs.find((log) => !!log.programs?.name)
    return latest?.programs?.name || null
  }, [workoutLogs])

  const weeklyWeightPoints = useMemo(() => {
    const source = [...weightLogs]

    if (source.length === 0 && initialWeightKg != null) {
      source.push({
        id: 'initial',
        client_id: clientId || 'unknown',
        measured_at: toDateKey(new Date()),
        weight_kg: initialWeightKg,
      })
    }

    const byWeek = new Map<string, ClientWeightLog>()

    source.forEach((entry) => {
      const date = new Date(entry.measured_at)
      if (Number.isNaN(date.getTime())) return
      const weekStart = getWeekStart(date)
      const key = toDateKey(weekStart)

      const current = byWeek.get(key)
      if (!current || current.measured_at < entry.measured_at) {
        byWeek.set(key, entry)
      }
    })

    const sortedWeeks = Array.from(byWeek.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(-12)

    return sortedWeeks.map(([weekStartKey, entry], index, array) => {
      const previous = index > 0 ? array[index - 1][1] : null
      const delta = previous ? Number((entry.weight_kg - previous.weight_kg).toFixed(2)) : null

      return {
        weekLabel: formatWeekLabel(new Date(weekStartKey)),
        weekStart: weekStartKey,
        weightKg: entry.weight_kg,
        deltaKg: delta,
      }
    })
  }, [weightLogs, initialWeightKg, clientId])

  // Bucket completed workouts into the last 12 weeks (same windowing as weight chart).
  const weeklySessionPoints = useMemo<WeeklySessionPoint[]>(() => {
    if (workoutLogs.length === 0) return []

    const counts = new Map<string, number>()
    workoutLogs.forEach((log) => {
      const date = new Date(log.completed_at)
      if (Number.isNaN(date.getTime())) return
      const weekStart = getWeekStart(date)
      const key = toDateKey(weekStart)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })

    // Build the last 12 contiguous weeks (including zeros) so the chart is stable.
    const weeks: Array<{ key: string; date: Date }> = []
    const firstWeek = getWeekStart(new Date())
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(firstWeek)
      d.setDate(d.getDate() - i * 7)
      weeks.push({ key: toDateKey(d), date: d })
    }

    return weeks.map(({ key, date }) => ({
      weekStart: key,
      weekLabel: formatWeekLabel(date),
      count: counts.get(key) ?? 0,
    }))
  }, [workoutLogs])

  return {
    loading,
    savingWeight,
    savingSession,
    error,
    tableReady,
    weightLogs,
    weeklyWeightPoints,
    weeklySessionPoints,
    thisWeekSessions,
    thisMonthSessions,
    latestProgramTitle,
    addWeightLog,
    addExternalSession,
    refetch: fetchData,
  }
}
