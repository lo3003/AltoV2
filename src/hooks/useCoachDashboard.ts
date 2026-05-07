import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface CoachClient {
  id: string
  auth_user_id?: string
  email: string
  full_name?: string
  client_code: string
  coach_id?: string
  main_goal?: string
  initial_weight_kg?: number
  training_frequency?: string
  age?: number
  avatar_url?: string
  created_at?: string
}

export interface ClientProgram {
  client_id: string
}

export interface CoachProgram {
  id: string
  name: string
  description?: string
  coach_id: string
  environment?: string
  difficulty?: string
  duration_weeks?: number
  cover_image_url?: string
  created_at?: string
  client_programs?: ClientProgram[]
}

export interface WorkoutLog {
  id: string
  client_id: string
  program_id?: string
  completed_at: string
  duration_minutes?: number
  notes?: string
  rating?: number | null
  feedback_notes?: string | null
  confirmation_photo_url?: string | null
  session_type?: string | null
  external_name?: string | null
  external_category?: string | null
  programs?: { name: string }
  clients?: { full_name: string }
}

interface WorkoutLogRow {
  id: string | number
  client_id: string | number
  program_id?: string | number | null
  completed_at: string
  duration_minutes?: number | null
  notes?: string | null
  programs?: { name: string } | Array<{ name: string }> | null
  clients?: { full_name: string } | Array<{ full_name: string }> | null
}

export interface CoachDashboardStats {
  activeClients: number
  completedSessionsWeek: number
  completedSessionsMonth: number
}

export interface CoachDashboardData {
  clients: CoachClient[]
  programs: CoachProgram[]
  recentLogs: WorkoutLog[]
  stats: CoachDashboardStats
  loading: boolean
  error: string | null
  fetchData: () => Promise<void>
}

export function useCoachDashboard(): CoachDashboardData {
  const { user } = useAuth()
  const [clients, setClients] = useState<CoachClient[]>([])
  const [programs, setPrograms] = useState<CoachProgram[]>([])
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([])
  const [stats, setStats] = useState<CoachDashboardStats>({
    activeClients: 0,
    completedSessionsWeek: 0,
    completedSessionsMonth: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch coach's clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })

      if (clientsError) throw clientsError
      if (clientsData) setClients(clientsData)

      // Fetch coach's programs with client assignments
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select(`*, client_programs ( client_id )`)
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })

      if (programsError) throw programsError
      if (programsData) setPrograms(programsData)

      // Fetch recent workout logs from coach's clients
      const clientIds = (clientsData || []).map((c: CoachClient) => c.id)
      if (clientIds.length > 0) {
        const now = new Date()
        const startOfWeek = new Date(now)
        const day = startOfWeek.getDay()
        const mondayShift = day === 0 ? -6 : 1 - day
        startOfWeek.setDate(startOfWeek.getDate() + mondayShift)
        startOfWeek.setHours(0, 0, 0, 0)

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const { data: logsData, error: logsError } = await supabase
          .from('workout_logs')
          .select('*, programs(name), clients(full_name)')
          .in('client_id', clientIds)
          .order('completed_at', { ascending: false })
          .limit(20)

        if (logsError) throw logsError
        if (logsData) {
          const normalizedLogs = (logsData as WorkoutLogRow[]).map((log) => {
            const programRelation = Array.isArray(log.programs) ? log.programs[0] : log.programs
            const clientRelation = Array.isArray(log.clients) ? log.clients[0] : log.clients

            return {
              id: String(log.id),
              client_id: String(log.client_id),
              program_id: log.program_id != null ? String(log.program_id) : undefined,
              completed_at: log.completed_at,
              duration_minutes: log.duration_minutes ?? undefined,
              notes: log.notes ?? undefined,
              programs: programRelation?.name ? { name: programRelation.name } : undefined,
              clients: clientRelation?.full_name ? { full_name: clientRelation.full_name } : undefined,
            } as WorkoutLog
          })

          setRecentLogs(normalizedLogs)
        }

        const [{ count: weekCount, error: weekError }, { count: monthCount, error: monthError }] = await Promise.all([
          supabase
            .from('workout_logs')
            .select('id', { count: 'exact', head: true })
            .in('client_id', clientIds)
            .gte('completed_at', startOfWeek.toISOString()),
          supabase
            .from('workout_logs')
            .select('id', { count: 'exact', head: true })
            .in('client_id', clientIds)
            .gte('completed_at', startOfMonth.toISOString()),
        ])

        if (weekError) throw weekError
        if (monthError) throw monthError

        setStats({
          activeClients: clientIds.length,
          completedSessionsWeek: weekCount || 0,
          completedSessionsMonth: monthCount || 0,
        })
      } else {
        setRecentLogs([])
        setStats({
          activeClients: 0,
          completedSessionsWeek: 0,
          completedSessionsMonth: 0,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement'
      setError(message)
      console.error('useCoachDashboard error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { clients, programs, recentLogs, stats, loading, error, fetchData }
}
