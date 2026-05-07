import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ScheduledSession {
  id: string | number
  client_id: string | number
  program_id: string | number
  program_name: string
  coach_scheduled_date: string
  scheduled_date: string
  status: string
}

interface ScheduledSessionRow {
  id: string | number
  client_id: string | number
  program_id: string | number
  coach_scheduled_date?: string | null
  scheduled_date: string
  status?: string | null
  programs?: {
    id: string | number
    name: string
  } | Array<{
    id: string | number
    name: string
  }> | null
}

export interface CreateScheduledSessionInput {
  programId: string | number
  scheduledDate: string
}

export interface RescheduleSessionByClientInput {
  sessionId: string | number
  scheduledDate: string
}

export interface UpdateSessionByCoachInput {
  sessionId: string | number
  programId: string | number
  scheduledDate: string
}

export interface CancelSessionByCoachInput {
  sessionId: string | number
}

const normalizeId = (value: string | number) => {
  if (typeof value === 'number') return value
  return /^\d+$/.test(value) ? Number(value) : value
}

const isMissingScheduledSessionsTableError = (error: any) => {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()

  if (code === '42P01' || code === 'PGRST205') return true
  if (message.includes('scheduled_sessions') && (message.includes('does not exist') || message.includes('could not find'))) {
    return true
  }

  return false
}

const toScheduledSession = (row: ScheduledSessionRow): ScheduledSession => {
  const program = Array.isArray(row.programs) ? row.programs[0] : row.programs
  const coachScheduledDate = row.coach_scheduled_date || row.scheduled_date

  return {
    id: row.id,
    client_id: row.client_id,
    program_id: row.program_id,
    program_name: program?.name || 'Programme',
    coach_scheduled_date: coachScheduledDate,
    scheduled_date: row.scheduled_date,
    status: row.status || 'planned',
  }
}

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const dayDiff = (from: string, to: string) => {
  const fromDate = dateFromKey(from)
  const toDate = dateFromKey(to)
  const ms = toDate.getTime() - fromDate.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

const sortSessions = (sessions: ScheduledSession[]) => {
  return [...sessions].sort((left, right) => {
    if (left.scheduled_date === right.scheduled_date) {
      return String(left.program_name).localeCompare(String(right.program_name))
    }
    return left.scheduled_date.localeCompare(right.scheduled_date)
  })
}

export function useClientCalendar(clientId?: string | number | null) {
  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tableReady, setTableReady] = useState(true)

  const fetchSessions = useCallback(async () => {
    if (!clientId) {
      setSessions([])
      setTableReady(true)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .select(`
          id,
          client_id,
          program_id,
          coach_scheduled_date,
          scheduled_date,
          status,
          programs (
            id,
            name
          )
        `)
        .eq('client_id', normalizeId(clientId))
        .order('scheduled_date', { ascending: true })

      if (error) {
        if (isMissingScheduledSessionsTableError(error)) {
          setSessions([])
          setTableReady(false)
          return
        }
        throw error
      }

      const mapped = ((data || []) as ScheduledSessionRow[]).map(toScheduledSession)
      setSessions(sortSessions(mapped))
      setTableReady(true)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const scheduleSession = useCallback(async (payload: CreateScheduledSessionInput) => {
    if (!clientId) {
      throw new Error('Client introuvable pour la planification.')
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .insert({
          client_id: normalizeId(clientId),
          program_id: normalizeId(payload.programId),
          coach_scheduled_date: payload.scheduledDate,
          scheduled_date: payload.scheduledDate,
          status: 'planned',
        })
        .select(`
          id,
          client_id,
          program_id,
          coach_scheduled_date,
          scheduled_date,
          status,
          programs (
            id,
            name
          )
        `)
        .single()

      if (error) {
        if (isMissingScheduledSessionsTableError(error)) {
          setTableReady(false)
          throw new Error('La table scheduled_sessions est absente. Exécutez la migration SQL dédiée.')
        }

        if (error.code === '23505') {
          throw new Error('Cette séance est déjà planifiée pour ce programme à cette date.')
        }

        throw error
      }

      const nextSession = toScheduledSession(data as ScheduledSessionRow)
      setSessions((prev) => sortSessions([...prev, nextSession]))
      setTableReady(true)

      return nextSession
    } finally {
      setSaving(false)
    }
  }, [clientId])

  const rescheduleSessionByClient = useCallback(async (payload: RescheduleSessionByClientInput) => {
    if (!clientId) {
      throw new Error('Client introuvable pour la replanification.')
    }

    const session = sessions.find((item) => String(item.id) === String(payload.sessionId))
    if (!session) {
      throw new Error('Séance introuvable.')
    }

    const diff = dayDiff(session.coach_scheduled_date, payload.scheduledDate)
    if (Math.abs(diff) > 3) {
      throw new Error('Vous pouvez déplacer la séance uniquement à ±3 jours de la date prévue par le coach.')
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .update({
          scheduled_date: payload.scheduledDate,
        })
        .eq('id', normalizeId(payload.sessionId))
        .eq('client_id', normalizeId(clientId))
        .select(`
          id,
          client_id,
          program_id,
          coach_scheduled_date,
          scheduled_date,
          status,
          programs (
            id,
            name
          )
        `)
        .single()

      if (error) {
        if (isMissingScheduledSessionsTableError(error)) {
          setTableReady(false)
          throw new Error('La table scheduled_sessions est absente. Exécutez la migration SQL dédiée.')
        }

        if (error.code === '23505') {
          throw new Error('Une séance identique existe déjà à cette date.')
        }

        throw error
      }

      const nextSession = toScheduledSession(data as ScheduledSessionRow)

      setSessions((prev) => {
        const updated = prev.map((item) =>
          String(item.id) === String(nextSession.id) ? nextSession : item
        )
        return sortSessions(updated)
      })

      setTableReady(true)

      return nextSession
    } finally {
      setSaving(false)
    }
  }, [clientId, sessions])

  const updateSessionByCoach = useCallback(async (payload: UpdateSessionByCoachInput) => {
    if (!clientId) {
      throw new Error('Client introuvable pour la modification de séance.')
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .update({
          program_id: normalizeId(payload.programId),
          coach_scheduled_date: payload.scheduledDate,
          scheduled_date: payload.scheduledDate,
          status: 'planned',
        })
        .eq('id', normalizeId(payload.sessionId))
        .eq('client_id', normalizeId(clientId))
        .select(`
          id,
          client_id,
          program_id,
          coach_scheduled_date,
          scheduled_date,
          status,
          programs (
            id,
            name
          )
        `)
        .single()

      if (error) {
        if (isMissingScheduledSessionsTableError(error)) {
          setTableReady(false)
          throw new Error('La table scheduled_sessions est absente. Exécutez la migration SQL dédiée.')
        }

        if (error.code === '23505') {
          throw new Error('Une séance identique existe déjà pour ce programme à cette date.')
        }

        throw error
      }

      const nextSession = toScheduledSession(data as ScheduledSessionRow)

      setSessions((prev) => {
        const updated = prev.map((item) =>
          String(item.id) === String(nextSession.id) ? nextSession : item
        )
        return sortSessions(updated)
      })

      setTableReady(true)

      return nextSession
    } finally {
      setSaving(false)
    }
  }, [clientId])

  const cancelSessionByCoach = useCallback(async (payload: CancelSessionByCoachInput) => {
    if (!clientId) {
      throw new Error('Client introuvable pour l’annulation de séance.')
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .update({
          status: 'cancelled',
        })
        .eq('id', normalizeId(payload.sessionId))
        .eq('client_id', normalizeId(clientId))
        .select(`
          id,
          client_id,
          program_id,
          coach_scheduled_date,
          scheduled_date,
          status,
          programs (
            id,
            name
          )
        `)
        .single()

      if (error) {
        if (isMissingScheduledSessionsTableError(error)) {
          setTableReady(false)
          throw new Error('La table scheduled_sessions est absente. Exécutez la migration SQL dédiée.')
        }

        throw error
      }

      const nextSession = toScheduledSession(data as ScheduledSessionRow)

      setSessions((prev) => {
        const updated = prev.map((item) =>
          String(item.id) === String(nextSession.id) ? nextSession : item
        )
        return sortSessions(updated)
      })

      setTableReady(true)

      return nextSession
    } finally {
      setSaving(false)
    }
  }, [clientId])

  return {
    sessions,
    loading,
    saving,
    tableReady,
    fetchSessions,
    scheduleSession,
    rescheduleSessionByClient,
    updateSessionByCoach,
    cancelSessionByCoach,
  }
}
