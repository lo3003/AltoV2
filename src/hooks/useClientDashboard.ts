import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface Program {
  id: string | number
  name: string
  description?: string
  duration_weeks?: number
  difficulty?: string
  cover_image_url?: string
  exercises?: Exercise[]
}

export interface Exercise {
  id: string | number
  name: string
  order?: number
  sets?: number | string
  reps?: string | number
  charge?: string | number
  charge_type?: string
  rest_seconds?: number
  rest_time?: string | number
  muscle_group?: string
  body_part?: string
  execution_mode?: string
  is_section_header?: boolean
  photo_url?: string
}

export interface ClientProgram {
  id: string | number
  client_id: string | number
  program_id: string | number
  start_date?: string
  end_date?: string
  current_day?: number
  current_week?: number
  progress_percentage?: number
  programs: Program
}

export interface WorkoutLog {
  id: string
  client_id: string
  program_id?: string
  completed_at: string
  duration_minutes?: number
  calories_burned?: number
  notes?: string
  programs?: { name: string }
}

export interface ClientDashboardData {
  assignedPrograms: ClientProgram[]
  activeProgram: ClientProgram | null
  workoutLogs: WorkoutLog[]
  totalWorkouts: number
  thisWeekWorkouts: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useClientDashboard(clientId: string | undefined): ClientDashboardData {
  const [assignedPrograms, setAssignedPrograms] = useState<ClientProgram[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClientData = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch assigned programs with program details and exercises
      const { data: programsData, error: programsError } = await supabase
        .from('client_programs')
        .select(`*, programs (*, exercises (*))`)
        .eq('client_id', clientId)

      if (programsError) throw programsError

      if (programsData) {
        const now = new Date()
        const validPrograms = programsData.filter((assignment: ClientProgram) => {
          if (!assignment.programs) return false
          if (assignment.end_date && new Date(assignment.end_date) < now) return false
          return true
        })
        setAssignedPrograms(validPrograms)
      }

      // Fetch workout logs
      const { data: logsData, error: logsError } = await supabase
        .from('workout_logs')
        .select('*, programs(name)')
        .eq('client_id', clientId)
        .order('completed_at', { ascending: false })

      if (logsError) throw logsError

      if (logsData) setWorkoutLogs(logsData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des données'
      setError(message)
      console.error('useClientDashboard error:', err)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchClientData()
  }, [fetchClientData])

  // Derived data
  const activeProgram = assignedPrograms.length > 0 ? assignedPrograms[0] : null

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
  startOfWeek.setHours(0, 0, 0, 0)

  const thisWeekWorkouts = workoutLogs.filter(
    (log) => new Date(log.completed_at) >= startOfWeek
  ).length

  return {
    assignedPrograms,
    activeProgram,
    workoutLogs,
    totalWorkouts: workoutLogs.length,
    thisWeekWorkouts,
    loading,
    error,
    refetch: fetchClientData,
  }
}
