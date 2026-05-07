import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AssignProgramInput {
  programId: string
  startDate: string
  endDate: string
  coachInstructions?: string
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
  const [unassigning, setUnassigning] = useState(false)

  const assignProgramToClient = useCallback(async (clientId: string | number, payload: AssignProgramInput) => {
    setAssigning(true)
    try {
      const baseRow: Record<string, unknown> = {
        client_id: normalizeId(clientId),
        program_id: normalizeId(payload.programId),
        start_date: payload.startDate,
        end_date: payload.endDate,
      }
      const trimmedNote = payload.coachInstructions?.trim()
      if (trimmedNote) {
        baseRow.coach_instructions = trimmedNote
      }

      let result = await supabase
        .from('client_programs')
        .insert(baseRow)
        .select('*')
        .single()

      // Graceful fallback if migration hasn't been applied yet
      if (result.error) {
        const code = String(result.error.code || '')
        const message = String(result.error.message || '').toLowerCase()
        const missingColumn = code === 'PGRST204' || code === '42703' || message.includes('coach_instructions')

        if (missingColumn && trimmedNote) {
          const { coach_instructions, ...legacyRow } = baseRow
          result = await supabase
            .from('client_programs')
            .insert(legacyRow)
            .select('*')
            .single()
        }
      }

      if (result.error) {
        if (result.error.code === '23505') {
          throw new Error('Ce programme est déjà assigné à ce client.')
        }
        throw result.error
      }

      return result.data as ClientProgramAssignment
    } finally {
      setAssigning(false)
    }
  }, [])

  /**
   * Remove the link between a program and a client.
   *
   * Cleanup rules:
   *  - All `planned` sessions for this (client, program) pair are deleted (whatever the date).
   *    This prevents stale rows that would become un-cancellable once the program is gone.
   *  - `completed`, `cancelled` and `skipped` sessions are KEPT (they are part of the history).
   */
  const unassignProgramFromClient = useCallback(
    async (
      clientId: string | number,
      programId: string | number,
      options: { cleanupSessions?: boolean } = { cleanupSessions: true }
    ) => {
      setUnassigning(true)
      try {
        const normalizedClientId = normalizeId(clientId)
        const normalizedProgramId = normalizeId(programId)

        // 1) Delete every planned session for that (client, program) pair.
        //    Best-effort: silently ignore failures (missing table, RLS, etc.)
        if (options.cleanupSessions) {
          await supabase
            .from('scheduled_sessions')
            .delete()
            .eq('client_id', normalizedClientId)
            .eq('program_id', normalizedProgramId)
            .eq('status', 'planned')
        }

        // 2) Remove the assignment row(s)
        const { error } = await supabase
          .from('client_programs')
          .delete()
          .eq('client_id', normalizedClientId)
          .eq('program_id', normalizedProgramId)

        if (error) throw error
      } finally {
        setUnassigning(false)
      }
    },
    []
  )

  return {
    assigning,
    unassigning,
    assignProgramToClient,
    unassignProgramFromClient,
  }
}
