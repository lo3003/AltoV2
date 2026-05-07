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

  const fetchPreview = useCallback(async () => {
    if (!programId) {
      setProgram(null)
      setExercises([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: programRow, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single()

      if (programError) throw programError

      const row = (programRow || {}) as Record<string, unknown>

      // Try to load assignment-level coach instructions for the current client.
      // Silent failure if migration not applied or user is the coach previewing.
      let assignmentInstructions: string | null = null
      if (user?.id) {
        try {
          const { data: clientRow } = await supabase
            .from('clients')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle()
          if (clientRow?.id) {
            const { data: assignmentRow } = await supabase
              .from('client_programs')
              .select('coach_instructions')
              .eq('client_id', clientRow.id)
              .eq('program_id', programId)
              .maybeSingle()
            assignmentInstructions = toNullableString(assignmentRow?.coach_instructions)
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
          amrap_duration
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
  }
}
