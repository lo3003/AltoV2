import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProgramDetails {
  id: string
  name: string
}

export interface WorkoutExercise {
  id: string
  program_id: string
  name: string
  order: number
  type?: string | null
  execution_mode?: string | null
  sets?: number
  reps?: string
  rest_time?: string
  charge?: string
  charge_type?: string
  duration_minutes?: number | string | null
  intensity?: string
  body_part?: string
  photo_url?: string
  video_url?: string
  comment?: string
  superset_id?: string
  effort_type?: string | null
  reps_min?: number | null
  reps_max?: number | null
  parent_exercise_id?: string | null
  is_section_header?: boolean
}

export interface UseActiveWorkoutReturn {
  program: ProgramDetails | null
  exercises: WorkoutExercise[]
  loading: boolean
  error: string | null
  
  // State
  currentExerciseIndex: number
  currentSetIndex: number
  isResting: boolean
  isFinished: boolean
  wasStoppedEarly: boolean
  completedExercises: Set<string>
  sessionStartTime: Date | null
  sessionEndTime: Date | null

  // Actions
  nextSet: () => void
  finishRest: () => void
  selectExercise: (index: number) => void
  endWorkout: (stoppedEarly?: boolean) => void
}

export function useActiveWorkout(programId?: string): UseActiveWorkoutReturn {  
  const [program, setProgram] = useState<ProgramDetails | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Execution State
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [currentSetIndex, setCurrentSetIndex] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [wasStoppedEarly, setWasStoppedEarly] = useState(false)
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null)

  const fetchWorkoutData = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch Program info
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', programId)
        .single()

      if (programError) throw programError
      setProgram(programData)

      // 2. Fetch Exercises for this program
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')
        .eq('program_id', programId)
        .order('order', { ascending: true })

      if (exercisesError) throw exercisesError

      // Filter out section headers
      const validExercises = (exercisesData || []).filter(ex => !ex.is_section_header)
      setExercises(validExercises)

    } catch (err: any) {
       setError(err.message || 'Error loading workout data')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchWorkoutData()
  }, [fetchWorkoutData])

  // Current session logic
  const currentExercise = exercises[currentExerciseIndex]
  const totalSets = currentExercise?.sets || 1

  // Start timer on mount
  useEffect(() => {
    setSessionStartTime(new Date())
  }, [])

  const nextSet = useCallback(() => {
    if (!currentExercise) return

    // Final set of the current exercise
    if (currentSetIndex >= totalSets - 1) {

      // Mark as completed
      setCompletedExercises(prev => {
        const next = new Set(prev)
        next.add(currentExercise.id)
        return next
      })

      // If it's the last exercise of the whole workout
      if (currentExerciseIndex >= exercises.length - 1) {
        // Workout Finished
        setIsFinished(true)
        setWasStoppedEarly(false)
        setSessionEndTime(new Date())
        return
      }

      // Has a rest time?
      if (currentExercise.rest_time) {
        setIsResting(true)
      } else {
        // Or immediately jump to next exercise
        setCurrentSetIndex(0)
        setCurrentExerciseIndex(prev => prev + 1)
      }
    } else {
      // Just moving to the next set
      if (currentExercise.rest_time) {
         setIsResting(true)
      } else {
         setCurrentSetIndex(prev => prev + 1)
      }
    }
  }, [currentExercise, currentSetIndex, totalSets, currentExerciseIndex, exercises.length])

  const finishRest = useCallback(() => {
    setIsResting(false)
    
    // Were we at the end of the sets?
    if (currentSetIndex >= totalSets - 1) {
       // Proceed to next exercise
       setCurrentSetIndex(0)
       setCurrentExerciseIndex(prev => prev + 1)
    } else {
       // Proceed to next set
       setCurrentSetIndex(prev => prev + 1)
    }
  }, [currentSetIndex, totalSets])

  const selectExercise = useCallback((index: number) => {
    if (index >= 0 && index < exercises.length) {
      setCurrentExerciseIndex(index)
      setCurrentSetIndex(0)
      setIsResting(false)
    }
  }, [exercises.length])

  const endWorkout = useCallback((stoppedEarly: boolean = true) => {
    setIsFinished(true)
    setWasStoppedEarly(stoppedEarly)
    if (!sessionEndTime) {
      setSessionEndTime(new Date())
    }
  }, [sessionEndTime])

  return {
    program,
    exercises,
    loading,
    error,

    currentExerciseIndex,
    currentSetIndex,
    isResting,
    isFinished,
    wasStoppedEarly,
    completedExercises,
    sessionStartTime,
    sessionEndTime,

    nextSet,
    finishRest,
    selectExercise,
    endWorkout
  }
}