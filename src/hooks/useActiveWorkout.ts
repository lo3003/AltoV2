import { useState, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProgramDetails {
  id: string
  name: string
  description?: string | null
  session_instructions?: string | null
  estimated_duration_minutes?: number | null
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
  tabata_work?: number | null
  tabata_rest?: number | null
  amrap_duration?: number | null
  effort_detail?: string | null
  set_details?: Array<{ charge?: string; reps?: string; recup?: string }> | null
  variants?: Array<{
    id: string
    name: string
    photo_url?: string | null
    body_part?: string | null
    sets?: string | number | null
    reps?: string | number | null
    charge?: string | number | null
    charge_type?: string | null
    rest_time?: string | null
    effort_type?: string | null
    reps_min?: number | null
    reps_max?: number | null
    duration_minutes?: string | null
    comment?: string | null
  }> | null
}

export type WorkoutExecutionMode = 'Classic' | 'Superset' | 'Circuit' | 'AMRAP' | 'EMOM' | 'Tabata'

export interface WorkoutExerciseBlock {
  id: string
  supersetId: string | null
  mode: WorkoutExecutionMode
  exercises: WorkoutExercise[]
  rounds: number
}

export interface UseActiveWorkoutReturn {
  program: ProgramDetails | null
  exercises: WorkoutExercise[]
  blocks: WorkoutExerciseBlock[]
  loading: boolean
  error: string | null
  
  // State
  currentBlockIndex: number
  currentBlock: WorkoutExerciseBlock | null
  currentExerciseIndex: number
  currentExerciseInBlockIndex: number
  currentRound: number
  currentSetIndex: number
  blockRoundCount: number
  executionMode: WorkoutExecutionMode
  isTimedMode: boolean
  isResting: boolean
  currentRestDuration: string | null
  isFinished: boolean
  wasStoppedEarly: boolean
  completedExercises: Set<string>
  sessionStartTime: Date | null
  sessionEndTime: Date | null

  // Actions
  nextSet: () => void
  finishRest: () => void
  selectExercise: (index: number) => void
  completeTimedBlock: () => void
  setTimedExerciseIndex: (index: number) => void
  endWorkout: (stoppedEarly?: boolean) => void
}

const toSetsCount = (value?: string | number | null) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric)
  return 1
}

const normalizeExecutionMode = (mode?: string | null): WorkoutExecutionMode => {
  const normalized = String(mode || '').trim().toLowerCase()

  if (normalized === 'circuit' || normalized.includes('circuit')) return 'Circuit'
  if (normalized === 'amrap' || normalized.includes('amrap')) return 'AMRAP'
  if (normalized === 'emom' || normalized.includes('emom')) return 'EMOM'
  if (normalized === 'tabata' || normalized.includes('tabata')) return 'Tabata'
  return 'Superset'
}

const isTimedExecutionMode = (mode: WorkoutExecutionMode) => {
  return mode === 'AMRAP' || mode === 'EMOM' || mode === 'Tabata'
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

const toSortedExercises = (items: WorkoutExercise[]) => {
  return [...items].sort((left, right) => (left.order || 0) - (right.order || 0))
}

const buildExerciseBlocks = (inputExercises: WorkoutExercise[]): WorkoutExerciseBlock[] => {
  const sorted = toSortedExercises(inputExercises)
  const handledSupersetIds = new Set<string>()
  const blocks: WorkoutExerciseBlock[] = []

  sorted.forEach((exercise) => {
    const supersetId = exercise.superset_id ? String(exercise.superset_id) : null

    if (!supersetId) {
      blocks.push({
        id: `single-${exercise.id}`,
        supersetId: null,
        mode: 'Classic',
        exercises: [exercise],
        rounds: toSetsCount(exercise.sets),
      })
      return
    }

    if (handledSupersetIds.has(supersetId)) return

    handledSupersetIds.add(supersetId)
    const groupedExercises = sorted.filter((item) => String(item.superset_id || '') === supersetId)

    if (groupedExercises.length <= 1) {
      blocks.push({
        id: `single-${exercise.id}`,
        supersetId,
        mode: 'Classic',
        exercises: [exercise],
        rounds: toSetsCount(exercise.sets),
      })
      return
    }

    const mode = normalizeExecutionMode(exercise.execution_mode || exercise.type)
    const rounds = groupedExercises.reduce((maximum, item) => {
      return Math.max(maximum, toSetsCount(item.sets))
    }, 1)

    blocks.push({
      id: `group-${supersetId}`,
      supersetId,
      mode,
      exercises: groupedExercises,
      rounds,
    })
  })

  return blocks
}

export function useActiveWorkout(programId?: string): UseActiveWorkoutReturn {  
  const [program, setProgram] = useState<ProgramDetails | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [blocks, setBlocks] = useState<WorkoutExerciseBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Execution State
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [currentExerciseInBlockIndex, setCurrentExerciseInBlockIndex] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [isResting, setIsResting] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [wasStoppedEarly, setWasStoppedEarly] = useState(false)
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null)

  const currentBlock = useMemo(() => blocks[currentBlockIndex] || null, [blocks, currentBlockIndex])
  const currentExercise = useMemo(() => {
    if (!currentBlock) return null
    return currentBlock.exercises[currentExerciseInBlockIndex] || currentBlock.exercises[0] || null
  }, [currentBlock, currentExerciseInBlockIndex])

  const currentExerciseIndex = useMemo(() => {
    if (!currentExercise) return 0
    const foundIndex = exercises.findIndex((exercise) => String(exercise.id) === String(currentExercise.id))
    return foundIndex >= 0 ? foundIndex : 0
  }, [currentExercise, exercises])

  const executionMode: WorkoutExecutionMode = currentBlock?.mode || 'Classic'
  const isTimedMode = isTimedExecutionMode(executionMode)
  const blockRoundCount = currentBlock?.rounds || 1
  const currentSetIndex = Math.max(0, currentRound - 1)

  /**
   * Rest applicable to the current set:
   *  1) set_details[setIndex].recup  (rest configured per-set in the builder)
   *  2) exercise.rest_time           (default rest of the exercise)
   *  3) null                          (no rest)
   */
  const getRestForSet = useCallback(
    (exercise: WorkoutExercise | null | undefined, setIndex: number): string | null => {
      if (!exercise) return null
      const details = Array.isArray(exercise.set_details) ? exercise.set_details : null
      const recup = details?.[setIndex]?.recup
      if (recup != null && String(recup).trim()) return String(recup).trim()
      if (exercise.rest_time != null && String(exercise.rest_time).trim()) {
        return String(exercise.rest_time).trim()
      }
      return null
    },
    []
  )

  const currentRestDuration = getRestForSet(currentExercise, currentSetIndex)

  const markBlockAsCompleted = useCallback((blockToComplete: WorkoutExerciseBlock | null) => {
    if (!blockToComplete) return
    setCompletedExercises((previous) => {
      const next = new Set(previous)
      blockToComplete.exercises.forEach((exercise) => {
        next.add(String(exercise.id))
      })
      return next
    })
  }, [])

  const moveToNextBlock = useCallback((fromBlockIndex: number) => {
    if (fromBlockIndex >= blocks.length - 1) {
      setIsFinished(true)
      setWasStoppedEarly(false)
      setSessionEndTime(new Date())
      return
    }

    setCurrentBlockIndex(fromBlockIndex + 1)
    setCurrentExerciseInBlockIndex(0)
    setCurrentRound(1)
    setIsResting(false)
  }, [blocks.length])

  const fetchWorkoutData = useCallback(async () => {
    if (!programId) return
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
      const programData: ProgramDetails = {
        id: String(row.id || programId),
        name: String(row.name || 'Programme'),
        description: toNullableString(row.description),
        session_instructions: toNullableString(row.session_instructions),
        estimated_duration_minutes: toNullableInt(row.estimated_duration_minutes),
      }

      setProgram(programData)

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')
        .eq('program_id', programId)
        .order('order', { ascending: true })

      if (exercisesError) throw exercisesError

      const validExercises = ((exercisesData || []) as WorkoutExercise[]).filter((exercise) => !exercise.is_section_header)
      const normalizedExercises = toSortedExercises(validExercises)
      const nextBlocks = buildExerciseBlocks(normalizedExercises)

      setExercises(normalizedExercises)
      setBlocks(nextBlocks)
      setCurrentBlockIndex(0)
      setCurrentExerciseInBlockIndex(0)
      setCurrentRound(1)
      setIsResting(false)
      setIsFinished(false)
      setWasStoppedEarly(false)
      setCompletedExercises(new Set())
      setSessionStartTime(new Date())
      setSessionEndTime(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error loading workout data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchWorkoutData()
  }, [fetchWorkoutData])

  const nextSet = useCallback(() => {
    if (!currentBlock || !currentExercise || isTimedMode) return

    const isSingleExerciseBlock = currentBlock.exercises.length <= 1
    const isLastRound = currentRound >= currentBlock.rounds

    const restForThisSet = getRestForSet(currentExercise, currentRound - 1)

    if (isSingleExerciseBlock) {
      if (isLastRound) {
        // Honour a rest configured on the LAST set: show it, then finishRest
        // advances to the next block.
        if (restForThisSet) {
          setIsResting(true)
        } else {
          markBlockAsCompleted(currentBlock)
          moveToNextBlock(currentBlockIndex)
        }
        return
      }

      if (restForThisSet) {
        setIsResting(true)
      } else {
        setCurrentRound((previous) => previous + 1)
      }
      return
    }

    const isLastExerciseInGroup = currentExerciseInBlockIndex >= currentBlock.exercises.length - 1

    if (!isLastExerciseInGroup) {
      setCurrentExerciseInBlockIndex((previous) => previous + 1)
      return
    }

    const groupRest =
      restForThisSet ||
      getRestForSet(currentBlock.exercises[0], currentRound - 1)

    if (isLastRound) {
      if (groupRest) {
        setIsResting(true)
      } else {
        markBlockAsCompleted(currentBlock)
        moveToNextBlock(currentBlockIndex)
      }
      return
    }

    if (groupRest) {
      setIsResting(true)
    } else {
      setCurrentRound((previous) => previous + 1)
      setCurrentExerciseInBlockIndex(0)
    }
  }, [
    currentBlock,
    currentBlockIndex,
    currentExercise,
    currentExerciseInBlockIndex,
    currentRound,
    isTimedMode,
    markBlockAsCompleted,
    moveToNextBlock,
    getRestForSet,
  ])

  const finishRest = useCallback(() => {
    if (!isResting || !currentBlock || isTimedMode) return

    setIsResting(false)

    if (currentRound < currentBlock.rounds) {
      setCurrentRound((previous) => previous + 1)
      if (currentBlock.exercises.length > 1) {
        setCurrentExerciseInBlockIndex(0)
      }
    } else {
      // We were resting after the LAST set → advance to the next block now.
      markBlockAsCompleted(currentBlock)
      moveToNextBlock(currentBlockIndex)
    }
  }, [currentBlock, currentBlockIndex, currentRound, isResting, isTimedMode, markBlockAsCompleted, moveToNextBlock])

  const selectExercise = useCallback((index: number) => {
    if (index < 0 || index >= exercises.length) return

    const selectedExercise = exercises[index]
    const matchingBlockIndex = blocks.findIndex((block) =>
      block.exercises.some((exercise) => String(exercise.id) === String(selectedExercise.id))
    )

    if (matchingBlockIndex === -1) return

    const matchingBlock = blocks[matchingBlockIndex]
    const exerciseInBlockIndex = matchingBlock.exercises.findIndex(
      (exercise) => String(exercise.id) === String(selectedExercise.id)
    )

    setCurrentBlockIndex(matchingBlockIndex)
    setCurrentExerciseInBlockIndex(exerciseInBlockIndex >= 0 ? exerciseInBlockIndex : 0)
    setCurrentRound(1)
    setIsResting(false)
  }, [blocks, exercises])

  const completeTimedBlock = useCallback(() => {
    if (!currentBlock) return

    if (!isTimedExecutionMode(currentBlock.mode)) {
      nextSet()
      return
    }

    markBlockAsCompleted(currentBlock)
    moveToNextBlock(currentBlockIndex)
  }, [currentBlock, currentBlockIndex, markBlockAsCompleted, moveToNextBlock, nextSet])

  const setTimedExerciseIndex = useCallback((index: number) => {
    if (!currentBlock || !isTimedExecutionMode(currentBlock.mode)) return
    const totalInBlock = currentBlock.exercises.length
    if (totalInBlock <= 0) return

    const safeIndex = ((Math.floor(index) % totalInBlock) + totalInBlock) % totalInBlock
    setCurrentExerciseInBlockIndex(safeIndex)
  }, [currentBlock])

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
    blocks,
    loading,
    error,

    currentBlockIndex,
    currentBlock,
    currentExerciseIndex,
    currentExerciseInBlockIndex,
    currentRound,
    currentSetIndex,
    blockRoundCount,
    executionMode,
    isTimedMode,
    isResting,
    currentRestDuration,
    isFinished,
    wasStoppedEarly,
    completedExercises,
    sessionStartTime,
    sessionEndTime,

    nextSet,
    finishRest,
    selectExercise,
    completeTimedBlock,
    setTimedExerciseIndex,
    endWorkout
  }
}