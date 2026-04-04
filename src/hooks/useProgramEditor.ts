import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import type { Exercise } from '@/hooks/useExerciseLibrary'

// We extend Exercise for Program Items because they might have a temporary ID or order
export interface ProgramItem extends Exercise {
  order?: number
  is_section_header?: boolean
  superset_id?: string | null
  execution_mode?: string
  tabata_work?: number | null
  tabata_rest?: number | null
  amrap_duration?: number | null
  set_details?: any[] | null
}

export type ExecutionMode = 'Superset' | 'Circuit' | 'AMRAP' | 'EMOM' | 'Tabata'

const EXECUTION_MODES: ExecutionMode[] = ['Superset', 'Circuit', 'AMRAP', 'EMOM', 'Tabata']

export const normalizeExecutionMode = (mode?: string | null): ExecutionMode => {
  const normalized = String(mode || '').trim().toLowerCase()

  if (!normalized || normalized === 'classique' || normalized === 'classic') return 'Superset'
  if (normalized === 'superset' || normalized.includes('super set')) return 'Superset'
  if (normalized === 'circuit' || normalized.includes('circuit')) return 'Circuit'
  if (normalized === 'amrap' || normalized.includes('amrap')) return 'AMRAP'
  if (normalized === 'emom' || normalized.includes('emom')) return 'EMOM'
  if (normalized === 'tabata' || normalized.includes('tabata')) return 'Tabata'

  return EXECUTION_MODES.includes(mode as ExecutionMode) ? (mode as ExecutionMode) : 'Superset'
}

const hydrateLegacyGrouping = (rawItems: ProgramItem[]): ProgramItem[] => {
  let activeLegacyGroup: { mode: ExecutionMode; supersetId: string } | null = null

  const inferLegacyMode = (item: ProgramItem): ExecutionMode => {
    return normalizeExecutionMode(item.execution_mode || item.type)
  }

  return rawItems.map((item) => {
    const normalizedMode = inferLegacyMode(item)

    if (item.is_section_header) {
      activeLegacyGroup = null
      return {
        ...item,
        id: normalizeItemId(item.id),
        execution_mode: normalizedMode,
        superset_id: item.superset_id ? String(item.superset_id) : null,
      }
    }

    if (item.superset_id) {
      const normalizedSupersetId = String(item.superset_id)
      activeLegacyGroup = { mode: normalizedMode, supersetId: normalizedSupersetId }
      return {
        ...item,
        id: normalizeItemId(item.id),
        execution_mode: normalizedMode,
        superset_id: normalizedSupersetId,
      }
    }

    if (normalizedMode !== 'Superset') {
      if (!activeLegacyGroup || activeLegacyGroup.mode !== normalizedMode) {
        activeLegacyGroup = {
          mode: normalizedMode,
          supersetId: crypto.randomUUID(),
        }
      }

      return {
        ...item,
        id: normalizeItemId(item.id),
        execution_mode: normalizedMode,
        superset_id: activeLegacyGroup.supersetId,
      }
    }

    activeLegacyGroup = null
    return {
      ...item,
      id: normalizeItemId(item.id),
      execution_mode: normalizedMode,
      superset_id: null,
    }
  })
}

type AddItemOptions = {
  insertAt?: number
  supersetId?: string | null
  executionMode?: string
}

type ProgramEditorOptions = {
  clientId?: string | null
}

const normalizeItemId = (id: unknown): string => String(id)

const normalizeRelationalId = (value?: string | number | null) => {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return value
  const normalized = String(value).trim()
  if (!normalized) return null
  return /^\d+$/.test(normalized) ? Number(normalized) : normalized
}

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const sanitizeData = (data: any) => {
  const cleaned = { ...data }
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === '') cleaned[key] = null
  })
  return cleaned
}

export function useProgramEditor(
  programId: string | 'new',
  onDirtyChange?: (dirty: boolean) => void,
  options?: ProgramEditorOptions
) {
  const { user } = useAuth()
  const scopedClientId = normalizeRelationalId(options?.clientId)
  const [program, setProgram] = useState({ name: '', environment: 'Salle' })
  const [items, setItems] = useState<ProgramItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)


  const isNewProgram = programId === 'new' || !programId

  const markAsDirty = useCallback(() => {
    if (onDirtyChange) onDirtyChange(true)
  }, [onDirtyChange])

  const fetchProgramData = useCallback(async () => {
    if (isNewProgram) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: programData, error: progError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single()
        
      if (progError) throw progError

      if (programData) {
        setProgram({
          name: programData.name || '',
          environment: programData.environment || 'Salle',
        })
        
        const { data: exercisesData, error: exError } = await supabase
          .from('exercises')
          .select('*')
          .eq('program_id', programId)
          .order('order', { ascending: true })
        
        if (exError) throw exError
        
        const allExercises = hydrateLegacyGrouping((exercisesData || []) as ProgramItem[])
        // For simplicity now, we ignore variants logic since it was barely used in UI
        setItems(allExercises)
      }
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`)
    } finally {
      setLoading(false)
      if (onDirtyChange) onDirtyChange(false)
    }
  }, [programId, isNewProgram, onDirtyChange])

  useEffect(() => {
    fetchProgramData()
  }, [fetchProgramData])

  const handleProgramChange = (field: string, value: string) => {
    setProgram((prev) => ({ ...prev, [field]: value }))
    markAsDirty()
  }

  const handleChangeExecutionMode = (supersetId: string, mode: string) => {
    const normalizedMode = normalizeExecutionMode(mode)
    setItems((current) =>
      current.map((i) => (i.superset_id === supersetId ? { ...i, execution_mode: normalizedMode } : i))
    )
    markAsDirty()
  }

  const handleUpdateItemField = (itemId: string, field: string, value: any) => {
    const normalizedId = normalizeItemId(itemId)
    setItems((current) =>
      current.map((i) =>
        normalizeItemId(i.id) === normalizedId ? { ...i, [field]: value } : i
      )
    )
    markAsDirty()
  }

  const handleUpdateGroupField = (supersetId: string, field: string, value: any) => {
    setItems((current) =>
      current.map((i) => (i.superset_id === supersetId ? { ...i, [field]: value } : i))
    )
    markAsDirty()
  }

  const handleUngroupItem = (supersetId: string) => {
    setItems((current) =>
      current.map((i) =>
        i.superset_id === supersetId ? { ...i, superset_id: null, execution_mode: 'Superset' } : i
      )
    )
    markAsDirty()
  }

  const handleAddItem = (
    exercise: Exercise | { type: 'separator', name: string },
    options: AddItemOptions = {}
  ) => {
    const newItemId = crypto.randomUUID()
    const insertAt =
      typeof options.insertAt === 'number' && options.insertAt >= 0 ? options.insertAt : undefined

    if ('type' in exercise && exercise.type === 'separator') {
      const newSeparator: ProgramItem = {
        id: newItemId,
        name: exercise.name,
        is_section_header: true,
        coach_id: user?.id || '',
        is_template: false,
        program_id: null,
      } as ProgramItem
      setItems((prev) => {
        if (insertAt === undefined || insertAt > prev.length) {
          return [...prev, newSeparator]
        }
        const next = [...prev]
        next.splice(insertAt, 0, newSeparator)
        return next
      })
    } else {
      const newItem: ProgramItem = {
        ...exercise,
        id: newItemId,
        is_template: false,
        program_id: null,
        superset_id: options.supersetId ?? null,
        execution_mode: normalizeExecutionMode(options.executionMode),
      } as ProgramItem
      setItems((prev) => {
        if (insertAt === undefined || insertAt > prev.length) {
          return [...prev, newItem]
        }
        const next = [...prev]
        next.splice(insertAt, 0, newItem)
        return next
      })
    }
    markAsDirty()
    return newItemId
  }

  const handleDeleteItem = (itemId: string) => {
    const normalizedId = normalizeItemId(itemId)
    setItems((prev) => prev.filter((i) => normalizeItemId(i.id) !== normalizedId))
    markAsDirty()
  }

  const handleMoveItem = (oldIndex: number, newIndex: number) => {
    setItems((items) => {
      const copy = [...items]
      const [movedItem] = copy.splice(oldIndex, 1)
      copy.splice(newIndex, 0, movedItem)
      return copy
    })
    markAsDirty()
  }

  const handleGroupItems = (activeId: string, targetId: string) => {
    setItems((current) => {
      const normalizedActiveId = normalizeItemId(activeId)
      const normalizedTargetId = normalizeItemId(targetId)

      const activeItem = current.find((i) => normalizeItemId(i.id) === normalizedActiveId)
      const targetItem = current.find((i) => normalizeItemId(i.id) === normalizedTargetId)
      if (!activeItem || !targetItem || activeItem.is_section_header || targetItem.is_section_header) return current

      const newSupersetId = targetItem.superset_id || crypto.randomUUID()
      const executionMode = normalizeExecutionMode(targetItem.execution_mode)

      return current.map((i) => {
        if (
          normalizeItemId(i.id) === normalizedActiveId ||
          normalizeItemId(i.id) === normalizedTargetId
        ) {
          return { ...i, superset_id: newSupersetId, execution_mode: executionMode }
        }
        return i
      })
    })
    markAsDirty()
  }

  const handleSaveProgram = async () => {
    if (!user) {
      toast.error('Coach non connecté')
      return false
    }
    setIsSaving(true)
    if (!program.name.trim()) {
      toast.error('Nom du programme requis.')
      setIsSaving(false)
      return false
    }

    try {
      let savedProgramId: string | number | null =
        programId !== 'new' ? normalizeRelationalId(programId) : null
      let clonedFromProgramId: string | number | null = null

      const programDataToSave = {
        name: program.name,
        environment: program.environment,
        coach_id: user.id,
        ...(scopedClientId ? { specific_client_id: scopedClientId } : {}),
      }

      if (isNewProgram) {
        const { data, error } = await supabase
          .from('programs')
          .insert(programDataToSave)
          .select()
          .single()
        if (error) throw error
        savedProgramId = data.id
      } else {
        const normalizedExistingProgramId = normalizeRelationalId(savedProgramId)

        if (!normalizedExistingProgramId) {
          throw new Error('Programme introuvable pour la sauvegarde.')
        }

        if (scopedClientId) {
          const { data: currentProgramRecord, error: currentProgramError } = await supabase
            .from('programs')
            .select('id, specific_client_id')
            .eq('id', normalizedExistingProgramId)
            .single()

          if (currentProgramError) throw currentProgramError

          const { count: assignmentCount, error: assignmentCountError } = await supabase
            .from('client_programs')
            .select('id', { count: 'exact', head: true })
            .eq('program_id', normalizedExistingProgramId)

          if (assignmentCountError) throw assignmentCountError

          const existingSpecificClientId = normalizeRelationalId((currentProgramRecord as any)?.specific_client_id)
          const isClientSpecificProgram =
            existingSpecificClientId !== null && String(existingSpecificClientId) === String(scopedClientId)
          const isSharedAcrossClients = (assignmentCount || 0) > 1
          const shouldCloneForClient = !isClientSpecificProgram || isSharedAcrossClients

          if (shouldCloneForClient) {
            const { data: clonedProgram, error: cloneError } = await supabase
              .from('programs')
              .insert(programDataToSave)
              .select()
              .single()

            if (cloneError) throw cloneError

            clonedFromProgramId = normalizedExistingProgramId
            savedProgramId = clonedProgram.id
          } else {
            const { error } = await supabase
              .from('programs')
              .update(programDataToSave)
              .eq('id', normalizedExistingProgramId)
            if (error) throw error
            savedProgramId = normalizedExistingProgramId
          }
        } else {
          const { error } = await supabase
            .from('programs')
            .update(programDataToSave)
            .eq('id', normalizedExistingProgramId)
          if (error) throw error
          savedProgramId = normalizedExistingProgramId
        }
      }

      // Delete existing exercises associated with the program
      await supabase.from('exercises').delete().eq('program_id', savedProgramId)

      // Insert new ones
      if (items.length > 0 && savedProgramId) {
        const allInserts = items.map((item, index) => {
          const rawItem = {
            program_id: savedProgramId,
            order: index,
            name: item.name,
            is_section_header: item.is_section_header || false,
            type: item.type,
            body_part: item.body_part,
            sets: item.sets,
            reps: item.reps,
            charge: item.charge,
            charge_type: item.charge_type,
            effort_type: item.effort_type,
            reps_min: item.reps_min,
            reps_max: item.reps_max,
            rest_time: item.rest_time,
            photo_url: item.photo_url,
            coach_id: user.id,
            is_template: false,
            superset_id: item.superset_id || null,
            execution_mode: normalizeExecutionMode(item.execution_mode),
            tabata_work: item.tabata_work || null,
            tabata_rest: item.tabata_rest || null,
            amrap_duration: item.amrap_duration || null,
            set_details: item.set_details || null,
          }
          return sanitizeData(rawItem)
        })

        const { error: itemsError } = await supabase.from('exercises').insert(allInserts)
        if (itemsError) throw itemsError
      }

      const normalizedProgramId = normalizeRelationalId(savedProgramId)

      if (scopedClientId && normalizedProgramId) {
        if (clonedFromProgramId) {
          const { error: reassignmentError } = await supabase
            .from('client_programs')
            .update({ program_id: normalizedProgramId })
            .eq('client_id', scopedClientId)
            .eq('program_id', clonedFromProgramId)

          if (reassignmentError) {
            if (reassignmentError.code === '23505') {
              const { error: cleanupError } = await supabase
                .from('client_programs')
                .delete()
                .eq('client_id', scopedClientId)
                .eq('program_id', clonedFromProgramId)

              if (cleanupError) throw cleanupError
            } else {
              throw reassignmentError
            }
          }
        }

        const { data: existingAssignment, error: checkAssignmentError } = await supabase
          .from('client_programs')
          .select('id')
          .eq('client_id', scopedClientId)
          .eq('program_id', normalizedProgramId)
          .maybeSingle()

        if (checkAssignmentError) throw checkAssignmentError

        if (!existingAssignment) {
          const startDate = new Date()
          const endDate = new Date(startDate)
          endDate.setDate(endDate.getDate() + 28)

          const { error: assignError } = await supabase.from('client_programs').insert({
            client_id: scopedClientId,
            program_id: normalizedProgramId,
            start_date: toISODate(startDate),
            end_date: toISODate(endDate),
          })

          if (assignError && assignError.code !== '23505') throw assignError
        }
      }

      toast.success('Programme sauvegardé avec succès.')
      if (onDirtyChange) onDirtyChange(false)
      return savedProgramId
    } catch (error: any) {
      toast.error(error.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProgram = async () => {
    if (isNewProgram) return false
    setIsSaving(true)
    try {
      await supabase.from('client_programs').delete().eq('program_id', programId)
      await supabase.from('exercises').delete().eq('program_id', programId)
      await supabase.from('programs').delete().eq('id', programId)
      toast.success('Programme supprimé.')
      return true
    } catch (error: any) {
      toast.error(error.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  return {
    program,
    items,
    loading,
    isSaving,
    isNewProgram,
    handleProgramChange,
    handleChangeExecutionMode,
    handleUpdateItemField,
    handleUpdateGroupField,
    handleUngroupItem,
    handleAddItem,
    handleDeleteItem,
    handleMoveItem,
    handleGroupItems,
    handleSaveProgram,
    handleDeleteProgram,
  }
}
