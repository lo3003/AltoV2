import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { WorkoutExercise } from '@/hooks/useActiveWorkout'

export interface WorkoutPreviewProgram {
  id: string
  name: string
  description?: string | null
  session_instructions?: string | null
  estimated_duration_minutes?: number | null
  coach_instructions?: string | null
}

interface UseWorkoutPreviewResult {
  program: WorkoutPreviewProgram | null
  exercises: WorkoutExercise[]
  loading: boolean
  error: string | null
  /**
   * true quand le client n'a plus le droit de consulter le détail du programme :
   *  - programme déjà réalisé (un workout_log existe), OU
   *  - date de disponibilité dépassée.
   * Le coach propriétaire n'est jamais bloqué. Les programmes "toujours
   * accessibles" ne sont jamais bloqués non plus.
   */
  accessDenied: boolean
  accessDeniedReason: 'completed' | 'expired' | 'not_assigned' | null
  /** true si l'assignation est marquée "toujours accessible" → lancement libre. */
  alwaysAccessible: boolean
}

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const sortByOrder = (items: WorkoutExercise[]) => {
  return [...items].sort((left, right) => (left.order || 0) - (right.order || 0))
}

const toNullableString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const toNullableInt = (value: unknown) => {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.floor(numeric)
}

export function useWorkoutPreview(programId?: string): UseWorkoutPreviewResult {
  const { user } = useAuth()
  const [program, setProgram] = useState<WorkoutPreviewProgram | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [accessDeniedReason, setAccessDeniedReason] =
    useState<'completed' | 'expired' | 'not_assigned' | null>(null)
  const [alwaysAccessible, setAlwaysAccessible] = useState(false)

  const fetchPreview = useCallback(async () => {
    if (!programId) {
      setProgram(null)
      setExercises([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setAccessDenied(false)
    setAccessDeniedReason(null)
    setAlwaysAccessible(false)

    try {
      const { data: programRow, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single()

      if (programError) throw programError

      const row = (programRow || {}) as Record<string, unknown>
      const programCoachId = row.coach_id ? String(row.coach_id) : null
      const isCoachOwner = Boolean(user?.id && programCoachId && user.id === programCoachId)

      // Try to load assignment-level coach instructions for the current client.
      // Silent failure if migration not applied or user is the coach previewing.
      let assignmentInstructions: string | null = null
      if (user?.id && !isCoachOwner) {
        try {
          const { data: clientRow } = await supabase
            .from('clients')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle()

          if (clientRow?.id) {
            const { data: assignmentRow } = await supabase
              .from('client_programs')
              .select('coach_instructions, end_date, always_accessible')
              .eq('client_id', clientRow.id)
              .eq('program_id', programId)
              .maybeSingle()

            assignmentInstructions = toNullableString(assignmentRow?.coach_instructions)

            // ── Contrôle d'accès client ────────────────────────────────
            if (assignmentRow?.always_accessible) {
              setAlwaysAccessible(true)
            }
            if (!assignmentRow) {
              // Programme non (ou plus) assigné à ce client
              setAccessDenied(true)
              setAccessDeniedReason('not_assigned')
            } else if (!assignmentRow.always_accessible) {
              // 1) Date de disponibilité dépassée
              if (assignmentRow.end_date && String(assignmentRow.end_date) < todayKey()) {
                setAccessDenied(true)
                setAccessDeniedReason('expired')
              } else {
                // 2) Programme déjà réalisé (un workout_log existe)
                const { count } = await supabase
                  .from('workout_logs')
                  .select('id', { count: 'exact', head: true })
                  .eq('client_id', clientRow.id)
                  .eq('program_id', programId)
                if ((count ?? 0) > 0) {
                  setAccessDenied(true)
                  setAccessDeniedReason('completed')
                }
              }
            }
          }
        } catch {
          // Ignore — column missing or RLS rejected
        }
      }

      const programData: WorkoutPreviewProgram = {
        id: String(row.id || programId),
        name: String(row.name || 'Programme'),
        description: toNullableString(row.description),
        session_instructions: toNullableString(row.session_instructions),
        estimated_duration_minutes: toNullableInt(row.estimated_duration_minutes),
        coach_instructions: assignmentInstructions,
      }

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select(`
          id,
          program_id,
          name,
          "order",
          type,
          execution_mode,
          sets,
          reps,
          rest_time,
          charge,
          charge_type,
          duration_minutes,
          intensity,
          body_part,
          photo_url,
          video_url,
          comment,
          superset_id,
          effort_type,
          reps_min,
          reps_max,
          parent_exercise_id,
          is_section_header,
          tabata_work,
          tabata_rest,
          amrap_duration,
          effort_detail,
          set_details
        `)
        .eq('program_id', programId)
        .order('order', { ascending: true })

      if (exercisesError) throw exercisesError

      setProgram(programData)
      setExercises(sortByOrder((exercisesData || []) as WorkoutExercise[]))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement de la séance.'
      setError(message)
      setProgram(null)
      setExercises([])
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  return {
    program,
    exercises,
    loading,
    error,
    accessDenied,
    accessDeniedReason,
    alwaysAccessible,
  }
}
