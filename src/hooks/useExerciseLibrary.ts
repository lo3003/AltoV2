import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export interface Exercise {
  id: string
  name: string
  body_part?: string | null
  photo_url?: string | null
  charge_type?: string | null
  charge?: number | string | null
  effort_type?: string | null
  sets?: string | number | null
  reps?: string | number | null
  reps_min?: number | null
  reps_max?: number | null
  duration_minutes?: string | null
  rest_time?: string | null
  intensity?: string | null
  comment?: string | null
  coach_id: string
  is_template: boolean
  program_id: string | null
  type?: string | null
  created_at?: string
}

export function useExerciseLibrary() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLibrary = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('coach_id', user.id)
        .eq('is_template', true)
        .order('name', { ascending: true })

      if (error) throw error
      if (data) setExercises(data as Exercise[])
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`)
      console.error('Error fetching library:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  const sanitize = (d: any) => {
    const c = { ...d }
    Object.keys(c).forEach((k) => {
      if (c[k] === '') c[k] = null
    })
    return c
  }

  const handleSaveExercise = async (exerciseData: Partial<Exercise>, itemToEdit: Exercise | null) => {
    if (!user) return

    const { ...rest } = exerciseData
    const rawData = {
      ...rest,
      coach_id: user.id,
      is_template: true,
      program_id: null,
    }
    
    // Remove temporary ID if any
    if (rawData.id && String(rawData.id).startsWith('temp-')) {
      delete rawData.id
    }

    const dataToSave = sanitize(rawData)
    let error

    try {
      if (itemToEdit && itemToEdit.id) {
        const { error: updateError } = await supabase
          .from('exercises')
          .update(dataToSave)
          .eq('id', itemToEdit.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('exercises')
          .insert(dataToSave)
        error = insertError
      }

      if (error) throw error

      toast.success(itemToEdit ? 'Exercice mis à jour' : 'Exercice créé avec succès')
      fetchLibrary()
      return true
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`)
      console.error('Error saving exercise:', err)
      return false
    }
  }

  const handleDeleteExercise = async (item: Exercise) => {
    if (!item.id) return

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      toast.success('Exercice supprimé avec succès')
      fetchLibrary()
      return true
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`)
      console.error('Error deleting exercise:', err)
      return false
    }
  }

  return {
    exercises,
    loading,
    fetchLibrary,
    handleSaveExercise,
    handleDeleteExercise,
  }
}
