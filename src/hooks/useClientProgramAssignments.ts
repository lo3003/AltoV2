import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AssignProgramInput {
  programId: string
  startDate: string
  endDate: string
}

export interface ClientProgramAssignment {
  id: string | number
  client_id: string | number
  program_id: string | number
  start_date?: string | null
  end_date?: string | null
}

const normalizeId = (value: string | number) => {
  if (typeof value === 'number') return value
  return /^\d+$/.test(value) ? Number(value) : value
}

export function useClientProgramAssignments() {
  const [assigning, setAssigning] = useState(false)

  const assignProgramToClient = useCallback(async (clientId: string | number, payload: AssignProgramInput) => {
    setAssigning(true)
    try {
      const { data, error } = await supabase
        .from('client_programs')
        .insert({
          client_id: normalizeId(clientId),
          program_id: normalizeId(payload.programId),
          start_date: payload.startDate,
          end_date: payload.endDate,
        })
        .select('*')
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ce programme est déjà assigné à ce client.')
        }
        throw error
      }

      return data as ClientProgramAssignment
    } finally {
      setAssigning(false)
    }
  }, [])

  return {
    assigning,
    assignProgramToClient,
  }
}
