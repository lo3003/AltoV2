import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface CoachCalendarSession {
  id: string | number
  client_id: string | number
  program_id: string | number
  coach_scheduled_date: string
  scheduled_date: string
  status: string
  notes?: string | null
  program_name: string
  client_name: string
  client_avatar_url?: string | null
}

interface ScheduledSessionRow {
  id: string | number
  client_id: string | number
  program_id: string | number
  coach_scheduled_date?: string | null
  scheduled_date: string
  status?: string | null
  notes?: string | null
  programs?: {
    id: string | number
    name: string
  } | Array<{
    id: string | number
    name: string
  }> | null
  clients?: {
    id: string | number
    coach_id?: string | number | null
    full_name?: string | null
    email?: string | null
    avatar_url?: string | null
  } | Array<{
    id: string | number
    coach_id?: string | number | null
    full_name?: string | null
    email?: string | null
    avatar_url?: string | null
  }> | null
}

const isMissingScheduledSessionsTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false

  const code = String((error as { code?: string }).code || '')
  const message = String((error as { message?: string }).message || '').toLowerCase()

  if (code === '42P01' || code === 'PGRST205') return true
  return message.includes('scheduled_sessions') && (message.includes('does not exist') || message.includes('could not find'))
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toCoachCalendarSession = (row: ScheduledSessionRow): CoachCalendarSession => {
  const program = Array.isArray(row.programs) ? row.programs[0] : row.programs
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients

  return {
    id: row.id,
    client_id: row.client_id,
    program_id: row.program_id,
    coach_scheduled_date: row.coach_scheduled_date || row.scheduled_date,
    scheduled_date: row.scheduled_date,
    status: row.status || 'planned',
    notes: row.notes || null,
    program_name: program?.name || 'Programme',
    client_name: client?.full_name || client?.email || `Client #${row.client_id}`,
    client_avatar_url: client?.avatar_url || null,
  }
}

const sortSessions = (sessions: CoachCalendarSession[]) => {
  return [...sessions].sort((left, right) => {
    if (left.scheduled_date === right.scheduled_date) {
      if (left.client_name === right.client_name) {
        return left.program_name.localeCompare(right.program_name)
      }
      return left.client_name.localeCompare(right.client_name)
    }

    return left.scheduled_date.localeCompare(right.scheduled_date)
  })
}

export function useCoachCalendar(coachId?: string | null) {
  const [sessions, setSessions] = useState<CoachCalendarSession[]>([])
  const [loading, setLoading] = useState(false)
  const [tableReady, setTableReady] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    if (!coachId) return { data: [], error: null }

    // La table `clients` n'a pas de colonne `avatar_url` → on ne la sélectionne pas
    // (évite un 400 PostgREST systématique).
    return supabase
      .from('scheduled_sessions')
      .select(`
        id,
        client_id,
        program_id,
        coach_scheduled_date,
        scheduled_date,
        status,
        notes,
        programs (
          id,
          name
        ),
        clients!inner (
          id,
          coach_id,
          full_name,
          email
        )
      `)
      .eq('clients.coach_id', coachId)
      .order('scheduled_date', { ascending: true })
  }, [coachId])

  const refresh = useCallback(async () => {
    if (!coachId) {
      setSessions([])
      setTableReady(true)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await fetchRows()

      if (result.error) {
        if (isMissingScheduledSessionsTableError(result.error)) {
          setTableReady(false)
          setSessions([])
          return
        }

        throw result.error
      }

      const mapped = ((result.data || []) as ScheduledSessionRow[]).map(toCoachCalendarSession)
      setSessions(sortSessions(mapped))
      setTableReady(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement du calendrier coach.'
      setError(message)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [coachId, fetchRows])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const sessionsByDate = useMemo(() => {
    return sessions.reduce<Record<string, CoachCalendarSession[]>>((accumulator, session) => {
      if (!accumulator[session.scheduled_date]) {
        accumulator[session.scheduled_date] = []
      }
      accumulator[session.scheduled_date].push(session)
      return accumulator
    }, {})
  }, [sessions])

  const sessionCountByDate = useMemo(() => {
    return Object.entries(sessionsByDate).reduce<Record<string, number>>((accumulator, [dayKey, daySessions]) => {
      accumulator[dayKey] = daySessions.length
      return accumulator
    }, {})
  }, [sessionsByDate])

  const daysWithSessions = useMemo(() => {
    return Object.keys(sessionsByDate).map((dayKey) => {
      const [year, month, day] = dayKey.split('-').map(Number)
      return new Date(year, month - 1, day)
    })
  }, [sessionsByDate])

  const todaysCount = sessionCountByDate[toDateKey(new Date())] || 0

  return {
    sessions,
    sessionsByDate,
    sessionCountByDate,
    daysWithSessions,
    todaysCount,
    loading,
    tableReady,
    error,
    refresh,
  }
}
