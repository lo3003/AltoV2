import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  Calendar as CalendarIcon,
  History,
  Plus,
  MoreHorizontal,
  MessageSquare,
  Pencil,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { EditClientDialog } from '@/components/coach/EditClientDialog'
import { AssignProgramDialog } from '@/components/coach/AssignProgramDialog'
import { ScheduleSessionDialog } from '@/components/coach/ScheduleSessionDialog'
import { useCoachPrograms } from '@/hooks/useCoachPrograms'
import { useCoachClients, type ClientFormInput, type CoachClient } from '@/hooks/useCoachClients'
import { useClientProgramAssignments, type AssignProgramInput } from '@/hooks/useClientProgramAssignments'
import { useClientCalendar, type ScheduledSession } from '@/hooks/useClientCalendar'
import type { WorkoutLog } from '@/hooks/useCoachDashboard'

// Compute age from a YYYY-MM-DD birth_date string. Returns null if missing/invalid.
function computeAgeFromBirthDate(birthDate?: string | null): number | null {
  if (!birthDate) return null
  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const m = now.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

// Format a YYYY-MM-DD birth date as DD/MM/YYYY for display.
function formatBirthDateFr(birthDate?: string | null): string | null {
  if (!birthDate) return null
  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) return null
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

interface AssignedProgramCard {
  id: string
  name: string
  description?: string
  start_date?: string | null
  end_date?: string | null
}

interface ProgramSessionProgress {
  session_id: string
  coach_scheduled_date: string
  scheduled_date: string
  completed_at: string | null
  is_done: boolean
}

interface ClientProgramRow {
  id: string | number
  client_id: string | number
  program_id: string | number
  start_date?: string | null
  end_date?: string | null
  programs?: {
    id: string | number
    name: string
    description?: string | null
  } | Array<{
    id: string | number
    name: string
    description?: string | null
  }> | null
}

const formatShortDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const formatProgramRange = (startDate?: string | null, endDate?: string | null) => {
  return `Du ${formatShortDate(startDate)} au ${formatShortDate(endDate)}`
}

const normalizeId = (value: string | number) => {
  if (typeof value === 'number') return value
  return /^\d+$/.test(value) ? Number(value) : value
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const getDayKeyFromIso = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return toDateKey(date)
}

const isIsoOnOrAfterDay = (isoValue: string, dayKey: string) => {
  const isoDayKey = getDayKeyFromIso(isoValue)
  if (!isoDayKey) return false
  return isoDayKey >= dayKey
}

const startOfToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const getSessionStatusLabel = (status: string) => {
  const normalizedStatus = String(status).toLowerCase()
  switch (normalizedStatus) {
    case 'planned':
      return 'Planifiée'
    case 'completed':
      return 'Réalisée'
    case 'cancelled':
      return 'Annulée'
    case 'skipped':
      return 'Ignorée'
    default:
      return status
  }
}

const getSessionStatusClassName = (status: string) => {
  const normalizedStatus = String(status).toLowerCase()
  if (normalizedStatus === 'completed') return 'bg-emerald-100 text-emerald-700 border-none'
  if (normalizedStatus === 'cancelled') return 'bg-rose-100 text-rose-700 border-none'
  if (normalizedStatus === 'skipped') return 'bg-slate-200 text-slate-700 border-none'
  return 'bg-primary/10 text-primary border-none'
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('programs')
  const [client, setClient] = useState<CoachClient | null>(null)
  const [assignedPrograms, setAssignedPrograms] = useState<AssignedProgramCard[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [scheduleTargetDate, setScheduleTargetDate] = useState<Date | null>(null)
  const [sessionToEdit, setSessionToEdit] = useState<ScheduledSession | null>(null)
  const [editProgramId, setEditProgramId] = useState('')
  const [editScheduledDate, setEditScheduledDate] = useState('')
  const [openMenuProgramId, setOpenMenuProgramId] = useState<string | null>(null)
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null)
  const [programToUnassign, setProgramToUnassign] = useState<AssignedProgramCard | null>(null)
  const [sessionToCancel, setSessionToCancel] = useState<ScheduledSession | null>(null)

  const { updateClient, saving: isSavingClient } = useCoachClients()
  const { programs: coachPrograms } = useCoachPrograms(true)
  const {
    assigning: isAssigningProgram,
    unassigning: isUnassigningProgram,
    assignProgramToClient,
    unassignProgramFromClient,
  } = useClientProgramAssignments()
  const {
    sessions: scheduledSessions,
    loading: isCalendarLoading,
    saving: isSchedulingSession,
    tableReady: isCalendarTableReady,
    scheduleSession,
    updateSessionByCoach,
    cancelSessionByCoach,
  } = useClientCalendar(id)

  const scheduleProgramOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string }>()
    assignedPrograms.forEach((program) => {
      if (!options.has(program.id)) {
        options.set(program.id, { id: program.id, name: program.name })
      }
    })
    return Array.from(options.values())
  }, [assignedPrograms])

  const sessionsByDate = useMemo(() => {
    return scheduledSessions.reduce<Record<string, ScheduledSession[]>>((accumulator, session) => {
      if (!accumulator[session.scheduled_date]) {
        accumulator[session.scheduled_date] = []
      }
      accumulator[session.scheduled_date].push(session)
      return accumulator
    }, {})
  }, [scheduledSessions])

  const selectedDateKey = toDateKey(selectedDate)
  const selectedDateSessions = sessionsByDate[selectedDateKey] || []

  const sessionProgressByProgram = useMemo(() => {
    const sessionsByProgram = new Map<string, ScheduledSession[]>()
    scheduledSessions.forEach((session) => {
      const programKey = String(session.program_id)
      const current = sessionsByProgram.get(programKey) || []
      current.push(session)
      sessionsByProgram.set(programKey, current)
    })

    const completionDatesByProgram = new Map<string, string[]>()
    logs.forEach((log) => {
      if (!log.program_id || !log.completed_at) return

      const programKey = String(log.program_id)
      const current = completionDatesByProgram.get(programKey) || []
      current.push(log.completed_at)
      completionDatesByProgram.set(programKey, current)
    })

    completionDatesByProgram.forEach((dates, programKey) => {
      dates.sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
      completionDatesByProgram.set(programKey, dates)
    })

    const result = new Map<string, ProgramSessionProgress[]>()

    sessionsByProgram.forEach((sessions, programKey) => {
      const sortedSessions = [...sessions].sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date))
      const completionDates = completionDatesByProgram.get(programKey) || []
      const usedCompletionIndexes = new Set<number>()

      const mapped: ProgramSessionProgress[] = sortedSessions.map((session) => {
        let matchedCompletionIndex = -1

        matchedCompletionIndex = completionDates.findIndex(
          (iso, index) => !usedCompletionIndexes.has(index) && getDayKeyFromIso(iso) === session.scheduled_date
        )

        if (matchedCompletionIndex === -1) {
          matchedCompletionIndex = completionDates.findIndex(
            (iso, index) => !usedCompletionIndexes.has(index) && isIsoOnOrAfterDay(iso, session.scheduled_date)
          )
        }

        let completedAt: string | null = null
        if (matchedCompletionIndex !== -1) {
          usedCompletionIndexes.add(matchedCompletionIndex)
          completedAt = completionDates[matchedCompletionIndex]
        }

        const isDone = session.status === 'completed' || completedAt !== null

        return {
          session_id: String(session.id),
          coach_scheduled_date: session.coach_scheduled_date,
          scheduled_date: session.scheduled_date,
          completed_at: completedAt,
          is_done: isDone,
        }
      })

      result.set(programKey, mapped)
    })

    return result
  }, [scheduledSessions, logs])

  const scheduledDays = useMemo(() => {
    return Object.keys(sessionsByDate).map((key) => dateFromKey(key))
  }, [sessionsByDate])

  const calendarStats = useMemo(() => {
    const total = scheduledSessions.length
    const todayKey = toDateKey(startOfToday())
    const upcoming = scheduledSessions.filter(
      (s) => s.scheduled_date >= todayKey && String(s.status).toLowerCase() === 'planned'
    ).length
    const completed = scheduledSessions.filter(
      (s) => String(s.status).toLowerCase() === 'completed'
    ).length

    // Sessions in the visible month of selectedDate
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    const monthStartKey = toDateKey(monthStart)
    const monthEndKey = toDateKey(monthEnd)
    const thisMonth = scheduledSessions.filter(
      (s) => s.scheduled_date >= monthStartKey && s.scheduled_date <= monthEndKey
    ).length

    return { total, upcoming, completed, thisMonth }
  }, [scheduledSessions, selectedDate])

  const isPastDate = (date: Date) => date < startOfToday()
  const minSchedulableDate = toDateKey(startOfToday())

  const fetchAssignedPrograms = useCallback(async () => {
    if (!id) return

    const { data, error } = await supabase
      .from('client_programs')
      .select(`
        id,
        client_id,
        program_id,
        start_date,
        end_date,
        programs (
          id,
          name
        )
      `)
      .eq('client_id', normalizeId(id))
      .order('start_date', { ascending: false })

    if (error) throw error

    const mappedPrograms = ((data || []) as ClientProgramRow[]).reduce<AssignedProgramCard[]>((accumulator, row) => {
      const relatedProgram = Array.isArray(row.programs) ? row.programs[0] : row.programs
      if (!relatedProgram) return accumulator

      accumulator.push({
        id: String(relatedProgram.id),
        name: relatedProgram.name,
        description: relatedProgram.description || undefined,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
      })

      return accumulator
    }, [])

    setAssignedPrograms(mappedPrograms)
  }, [id])

  useEffect(() => {
    async function loadData() {
      if (!id) return
      setLoading(true)
      try {
        const [{ data: clientData, error: clientErr }, { data: fetchedLogs, error: logsErr }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', id).single(),
          supabase
            .from('workout_logs')
            .select(`
              *,
              programs(name)
            `)
            .eq('client_id', id)
            .order('completed_at', { ascending: false }),
        ])

        if (clientErr) throw clientErr
        if (logsErr) throw logsErr

        setClient(clientData as CoachClient)
        setLogs((fetchedLogs || []) as WorkoutLog[])

        await fetchAssignedPrograms()
      } catch (err) {
        console.error('Error loading client details:', err)
        const message = err instanceof Error ? err.message : 'Erreur lors du chargement du client.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, fetchAssignedPrograms])

  const handleEditClient = async (clientId: string, payload: ClientFormInput) => {
    try {
      const updatedClient = await updateClient(clientId, payload)
      setClient(updatedClient)
      toast.success(`Informations de "${updatedClient.full_name || updatedClient.email}" mises à jour.`)
      setIsEditDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du client.'
      toast.error(message)
    }
  }

  const handleAssignProgram = async (payload: AssignProgramInput) => {
    if (!id || !client) return

    try {
      const assignment = await assignProgramToClient(id, payload)
      const selectedProgram = coachPrograms.find((program) => String(program.id) === String(payload.programId))

      if (selectedProgram) {
        const nextAssignedProgram: AssignedProgramCard = {
          id: String(selectedProgram.id),
          name: selectedProgram.name,
          description: selectedProgram.description,
          start_date: assignment.start_date || payload.startDate,
          end_date: assignment.end_date || payload.endDate,
        }

        setAssignedPrograms((prev) => [nextAssignedProgram, ...prev.filter((item) => item.id !== nextAssignedProgram.id)])
        toast.success(`Programme "${selectedProgram.name}" assigné avec succès !`)
      } else {
        await fetchAssignedPrograms()
        toast.success('Programme assigné avec succès !')
      }

      setIsAssignDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l’assignation du programme.'
      toast.error(message)
    }
  }

  const handleUnassignProgram = async () => {
    if (!id || !programToUnassign) return

    try {
      await unassignProgramFromClient(id, programToUnassign.id, { cleanupSessions: true })
      setAssignedPrograms((prev) => prev.filter((item) => item.id !== programToUnassign.id))
      toast.success(`Programme « ${programToUnassign.name} » désassigné.`)
      setProgramToUnassign(null)
      setOpenMenuProgramId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la désassignation.'
      toast.error(message)
    }
  }

  const openScheduleDialogForDate = (date: Date) => {
    if (isPastDate(date)) {
      toast.error('Impossible de planifier une séance dans le passé.')
      return
    }

    if (!isCalendarTableReady) {
      toast.error('La table scheduled_sessions n\'est pas encore disponible. Lancez la migration SQL.')
      return
    }

    setScheduleTargetDate(date)
    setIsScheduleDialogOpen(true)
  }

  const handleCalendarDateSelect = (date?: Date) => {
    if (!date) return
    setSelectedDate(date)
    // Note: we no longer auto-open the schedule dialog — coach uses the explicit button
  }

  const handleScheduleSession = async (payload: { programId: string }) => {
    if (!id || !scheduleTargetDate) return

    try {
      const scheduledDate = toDateKey(scheduleTargetDate)
      const matchedProgram = scheduleProgramOptions.find((program) => program.id === payload.programId)

      await scheduleSession({
        programId: payload.programId,
        scheduledDate,
      })

      setSelectedDate(scheduleTargetDate)
      setIsScheduleDialogOpen(false)
      toast.success(`Séance planifiée${matchedProgram ? `: ${matchedProgram.name}` : ''} le ${scheduleTargetDate.toLocaleDateString('fr-FR')}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la planification de la séance.'
      toast.error(message)
    }
  }

  const openEditSessionDialog = (session: ScheduledSession) => {
    setSessionToEdit(session)
    setEditProgramId(String(session.program_id))
    setEditScheduledDate(session.scheduled_date)
  }

  const closeEditSessionDialog = () => {
    setSessionToEdit(null)
    setEditProgramId('')
    setEditScheduledDate('')
  }

  const handleUpdateSession = async () => {
    if (!sessionToEdit || !editProgramId || !editScheduledDate) {
      toast.error('Veuillez sélectionner un programme et une date.')
      return
    }

    try {
      const updatedSession = await updateSessionByCoach({
        sessionId: sessionToEdit.id,
        programId: editProgramId,
        scheduledDate: editScheduledDate,
      })

      setSelectedDate(dateFromKey(updatedSession.scheduled_date))
      closeEditSessionDialog()
      toast.success('Séance mise à jour avec succès.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la modification de la séance.'
      toast.error(message)
    }
  }

  const handleConfirmCancelSession = async () => {
    if (!sessionToCancel) return
    try {
      await cancelSessionByCoach({ sessionId: sessionToCancel.id })
      toast.success('Séance annulée.')
      setSessionToCancel(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l’annulation de la séance.'
      toast.error(message)
    }
  }

  const handleQuickShiftSession = async (session: ScheduledSession, deltaDays: number) => {
    const currentDate = dateFromKey(session.scheduled_date)
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + deltaDays)

    if (isPastDate(nextDate)) {
      toast.error('Impossible de déplacer une séance dans le passé.')
      return
    }

    try {
      const updated = await updateSessionByCoach({
        sessionId: session.id,
        programId: String(session.program_id),
        scheduledDate: toDateKey(nextDate),
      })
      setSelectedDate(dateFromKey(updated.scheduled_date))
      toast.success(`Séance déplacée au ${nextDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du déplacement de la séance.'
      toast.error(message)
    }
  }

  if (loading) {
    return <div className="p-8 text-center bg-slate-50 min-h-screen text-slate-500">Chargement des données du client...</div>
  }

  if (!client) {
    return <div className="p-8 text-center bg-slate-50 min-h-screen text-slate-500">Client introuvable.</div>
  }

  const initials = client.full_name
    ? client.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  return (
    <>
      <div className="flex flex-col bg-slate-50 relative">
        <div className="sticky top-0 z-30 border-b border-border/40 bg-white/95 backdrop-blur-lg px-4 py-3 pt-safe shadow-sm lg:px-8 lg:py-4">
          <div className="mx-auto max-w-7xl">
            <button
              onClick={() => navigate('/coach/clients')}
              className="group mb-3 flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900 lg:mb-6"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-slate-200">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline">Retour à la liste</span>
              <span className="sm:hidden">Retour</span>
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-5">
                <Avatar className="h-14 w-14 border-2 border-slate-100 ring-2 ring-white shadow-sm sm:h-20 sm:w-20 sm:ring-4 sm:shadow-lg">
                  <AvatarImage src={client.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/5 text-base font-bold text-primary sm:text-xl">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {client.full_name || client.email}
                  </h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 sm:mt-1 sm:gap-2 sm:text-sm">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {(() => {
                      const computed = computeAgeFromBirthDate(client.birth_date)
                      const display = computed ?? client.age ?? null
                      const formatted = formatBirthDateFr(client.birth_date)
                      if (display != null && formatted) return `${display} ans · ${formatted}`
                      if (display != null) return `${display} ans`
                      if (formatted) return formatted
                      return 'Âge N/A'
                    })()}</span>
                    <span className="text-slate-300">•</span>
                    <span className="truncate">{client.main_goal || 'Objectif non défini'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-slate-600 bg-white hover:bg-slate-50 border-slate-200 font-semibold shadow-sm sm:h-10">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Message</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="h-9 gap-1.5 rounded-xl text-slate-600 bg-white hover:bg-slate-50 border-slate-200 font-semibold shadow-sm sm:h-10"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Modifier les infos</span>
                  <span className="sm:hidden">Modifier</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/60 sm:w-[480px]">
                <TabsTrigger value="programs" className="rounded-xl text-xs font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-sm">Programmes</TabsTrigger>
                <TabsTrigger value="calendar" className="rounded-xl text-xs font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-sm">Calendrier</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl text-xs font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-sm">Historique</TabsTrigger>
              </TabsList>

              <TabsContent value="programs" className="mt-8 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Programmes assignés</h2>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {assignedPrograms.length === 0
                        ? 'Ce client n\'a pas encore de programme.'
                        : `${assignedPrograms.length} programme${assignedPrograms.length > 1 ? 's' : ''} en cours.`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAssignDialogOpen(true)}
                      className="h-10 rounded-xl border-slate-200 bg-white font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Assigner existant
                    </Button>
                    <Button
                      onClick={() => navigate(`/coach/programs/builder?clientId=${client.id}`)}
                      className="h-10 gap-2 rounded-xl bg-primary px-5 font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      Créer sur-mesure
                    </Button>
                  </div>
                </div>

                {assignedPrograms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/30 bg-white py-12 text-center ring-1 ring-primary/10">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Plus className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Aucun programme assigné</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500 max-w-sm">
                      Choisis l'une des deux options ci-dessous pour démarrer.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsAssignDialogOpen(true)}
                        className="h-11 rounded-xl border-slate-200 bg-white font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Assigner un programme existant
                      </Button>
                      <Button
                        onClick={() => navigate(`/coach/programs/builder?clientId=${client.id}`)}
                        className="h-11 gap-2 rounded-xl bg-primary font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4" />
                        Créer sur-mesure
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {assignedPrograms.map((program) => {
                      const progressRows = sessionProgressByProgram.get(program.id) || []
                      const completedCount = progressRows.filter((row) => row.is_done).length
                      const totalRows = progressRows.length
                      const hasProgress = totalRows > 0
                      const progressPercent = hasProgress ? Math.round((completedCount / totalRows) * 100) : 0
                      const isMenuOpen = openMenuProgramId === program.id
                      const isExpanded = expandedProgramId === program.id

                      return (
                        <Card
                          key={program.id}
                          className="group flex flex-col border-none bg-white shadow-sm ring-1 ring-slate-200/60 transition-shadow hover:shadow-md overflow-visible"
                        >
                          {/* Header row */}
                          <div className="relative px-5 pt-5 pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <Badge className="bg-emerald-100 text-emerald-700 border-none uppercase tracking-wider text-[10px] font-extrabold mb-2">
                                  Assigné
                                </Badge>
                                <h3 className="text-[15px] font-bold text-slate-900 leading-snug">
                                  {program.name}
                                </h3>
                                {program.description && (
                                  <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-2">
                                    {program.description}
                                  </p>
                                )}
                              </div>

                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuProgramId(isMenuOpen ? null : program.id)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Plus d'actions"
                                >
                                  <MoreHorizontal className="h-5 w-5" />
                                </button>

                                {isMenuOpen && (
                                  <>
                                    {/* Click-outside backdrop */}
                                    <div
                                      onClick={() => setOpenMenuProgramId(null)}
                                      className="fixed inset-0 z-20"
                                    />
                                    <div className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200/40">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuProgramId(null)
                                          navigate(`/coach/programs/builder?programId=${program.id}&clientId=${client.id}`)
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary"
                                      >
                                        <Eye className="h-4 w-4" />
                                        Voir / Modifier
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuProgramId(null)
                                          setProgramToUnassign(program)
                                        }}
                                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Désassigner
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Date range chip */}
                          <div className="px-5">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {formatProgramRange(program.start_date, program.end_date)}
                            </div>
                          </div>

                          {/* Progress section */}
                          <div className="px-5 pt-4 pb-3 mt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Avancement
                              </p>
                              {hasProgress ? (
                                <span className="text-[11px] font-extrabold text-emerald-700 tabular-nums">
                                  {completedCount}/{totalRows} faites
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-slate-400">—</span>
                              )}
                            </div>

                            {hasProgress && (
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-2">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            )}

                            {!isCalendarTableReady ? (
                              <p className="text-xs text-amber-700">
                                Planification indisponible (migration <code>scheduled_sessions</code> requise).
                              </p>
                            ) : isCalendarLoading ? (
                              <p className="text-xs text-slate-500">Chargement des séances…</p>
                            ) : !hasProgress ? (
                              <p className="text-xs text-slate-500">Aucune séance planifiée pour ce programme.</p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedProgramId(isExpanded ? null : program.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                              >
                                {isExpanded ? (
                                  <>
                                    Masquer le détail
                                    <ChevronUp className="h-3 w-3" />
                                  </>
                                ) : (
                                  <>
                                    Voir les {totalRows} séance{totalRows > 1 ? 's' : ''}
                                    <ChevronDown className="h-3 w-3" />
                                  </>
                                )}
                              </button>
                            )}

                            {hasProgress && isExpanded && (
                              <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                                {progressRows.map((row) => (
                                  <div
                                    key={row.session_id}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-semibold text-slate-700">
                                        Prévue le {formatShortDate(row.coach_scheduled_date)}
                                      </p>
                                      {row.scheduled_date !== row.coach_scheduled_date && (
                                        <p className="text-[10px] text-amber-700 font-medium">
                                          Déplacée au {formatShortDate(row.scheduled_date)}
                                        </p>
                                      )}
                                      {row.completed_at && (
                                        <p className="text-[10px] text-slate-500">
                                          Réalisée le {formatShortDate(row.completed_at)}
                                        </p>
                                      )}
                                    </div>

                                    <Badge
                                      variant="secondary"
                                      className={row.is_done
                                        ? 'bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold gap-1'
                                        : 'bg-amber-100 text-amber-700 border-none text-[10px] font-bold'}
                                    >
                                      {row.is_done && <CheckCircle2 className="h-3 w-3" />}
                                      {row.is_done ? 'Fait' : 'Non fait'}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Footer action */}
                          <button
                            type="button"
                            onClick={() => navigate(`/coach/programs/builder?programId=${program.id}&clientId=${client.id}`)}
                            className="mt-auto flex w-full items-center justify-center gap-1.5 border-t border-slate-100 py-3 text-[12px] font-bold text-primary transition-colors hover:bg-primary/5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Voir le programme
                          </button>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="calendar" className="mt-8 space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <CalendarStatCard label="Au total" value={calendarStats.total} accent="slate" />
                  <CalendarStatCard label="Ce mois" value={calendarStats.thisMonth} accent="primary" />
                  <CalendarStatCard label="À venir" value={calendarStats.upcoming} accent="amber" />
                  <CalendarStatCard label="Réalisées" value={calendarStats.completed} accent="emerald" />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(420px,520px)_1fr] items-start">
                  {/* Calendar card */}
                  <Card className="border-none bg-white shadow-sm ring-1 ring-slate-200/60 p-5 rounded-3xl w-full mx-auto lg:mx-0">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Planning des séances</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Clique sur un jour pour voir les séances ou en planifier une.
                        </p>
                      </div>
                    </div>

                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleCalendarDateSelect}
                      className="rounded-xl border-0 w-full [--cell-size:3rem]"
                      classNames={{ root: 'w-full' }}
                      modifiers={{
                        scheduled: scheduledDays,
                        past: (date) => isPastDate(date),
                      }}
                      modifiersClassNames={{
                        scheduled: 'relative bg-primary/10 text-primary font-bold after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary',
                        past: 'text-slate-400',
                      }}
                    />

                    {/* Legend */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="relative inline-flex h-3 w-3 rounded-md bg-primary/10">
                          <span className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-primary" />
                        </span>
                        Séance(s) prévue(s)
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-3 w-3 rounded-md bg-primary" />
                        Jour sélectionné
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-3 w-3 rounded-md bg-slate-100" />
                        Jour passé
                      </span>
                    </div>

                    {!isCalendarTableReady && (
                      <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-700">
                        La table <strong>scheduled_sessions</strong> n'est pas disponible. Exécutez la migration
                        <span className="ml-1 font-semibold">supabase/safe_scheduled_sessions.sql</span>.
                      </div>
                    )}
                  </Card>

                  {/* Day panel */}
                  <div className="space-y-4">
                    {/* Date header */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider">
                            {selectedDate.toLocaleDateString('fr-FR', { month: 'short' })}
                          </span>
                          <span className="text-base font-black leading-none">{selectedDate.getDate()}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 capitalize">
                            {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
                          </h3>
                          <p className="text-xs font-medium text-slate-500">
                            {selectedDateSessions.length === 0
                              ? 'Aucune séance prévue'
                              : `${selectedDateSessions.length} séance${selectedDateSessions.length > 1 ? 's' : ''} prévue${selectedDateSessions.length > 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => openScheduleDialogForDate(selectedDate)}
                        disabled={isPastDate(selectedDate) || !isCalendarTableReady}
                        className="h-10 gap-2 rounded-xl bg-primary px-5 font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Planifier
                      </Button>
                    </div>

                    {/* Sessions of the day */}
                    {isCalendarLoading ? (
                      <div className="bg-white rounded-2xl p-8 ring-1 ring-slate-200/60 text-sm font-medium text-slate-500">
                        Chargement des séances…
                      </div>
                    ) : selectedDateSessions.length === 0 ? (
                      <div className="bg-white rounded-2xl p-8 ring-1 ring-slate-200/60 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100">
                        <CalendarIcon className="h-10 w-10 text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-900">Aucune séance planifiée ce jour</p>
                        <p className="text-xs text-slate-500 mt-1 mb-5 max-w-sm">
                          {isPastDate(selectedDate)
                            ? 'Tu ne peux plus planifier dans le passé. Sélectionne une date à venir.'
                            : 'Choisis l\'un des programmes assignés et planifie une séance pour ce jour.'}
                        </p>
                        {!isPastDate(selectedDate) && (
                          <Button
                            onClick={() => openScheduleDialogForDate(selectedDate)}
                            disabled={!isCalendarTableReady}
                            className="h-11 gap-2 rounded-xl bg-primary px-5 font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90"
                          >
                            <Plus className="h-4 w-4" />
                            Planifier une séance
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedDateSessions.map((session) => {
                          const normalizedStatus = String(session.status).toLowerCase()
                          const canEdit = !['completed', 'cancelled'].includes(normalizedStatus)
                          const canCancel = !['completed', 'cancelled'].includes(normalizedStatus)

                          return (
                            <Card
                              key={session.id}
                              className="border-none bg-white p-4 shadow-sm ring-1 ring-slate-200/60 rounded-2xl"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[15px] font-bold text-slate-900 truncate">
                                      {session.program_name}
                                    </p>
                                    <Badge className={getSessionStatusClassName(session.status)}>
                                      {getSessionStatusLabel(session.status)}
                                    </Badge>
                                  </div>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    Prévue le {new Date(session.scheduled_date).toLocaleDateString('fr-FR', {
                                      weekday: 'long',
                                      day: 'numeric',
                                      month: 'long',
                                    })}
                                  </p>
                                  {session.coach_scheduled_date !== session.scheduled_date && (
                                    <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                                      Date initiale : {formatShortDate(session.coach_scheduled_date)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {canEdit && (
                                <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                                  {/* Quick shift -1 day / +1 day */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQuickShiftSession(session, -1)}
                                    disabled={isSchedulingSession}
                                    className="h-9 gap-1 rounded-lg text-slate-700 hover:bg-slate-100"
                                    title="Avancer d'1 jour"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                    1j
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQuickShiftSession(session, 1)}
                                    disabled={isSchedulingSession}
                                    className="h-9 gap-1 rounded-lg text-slate-700 hover:bg-slate-100"
                                    title="Reporter d'1 jour"
                                  >
                                    1j
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>

                                  <span className="mx-1 h-5 w-px bg-slate-200" />

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditSessionDialog(session)}
                                    disabled={isSchedulingSession}
                                    className="h-9 gap-1.5 rounded-lg border-slate-200 font-semibold"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Modifier
                                  </Button>
                                  {canCancel && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSessionToCancel(session)}
                                      disabled={isSchedulingSession}
                                      className="h-9 gap-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Annuler
                                    </Button>
                                  )}
                                </div>
                              )}
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Journal d'Activité</h2>
                  {logs.length > 0 && (
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {logs.length} séance{logs.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                  {logs.length === 0 ? (
                    <div className="p-8 text-center text-sm font-medium text-slate-500">
                      Aucun historique de séance complétée pour le moment.
                    </div>
                  ) : (
                    <div className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto custom-scrollbar">
                      {logs.map((log) => {
                        const rating = typeof log.rating === 'number' ? log.rating : null
                        const ratingLabels = ['Très facile', 'Facile', 'Normal', 'Difficile', 'Très difficile']
                        const ratingLabel = rating != null && rating >= 1 && rating <= 5 ? ratingLabels[rating - 1] : null
                        const ratingColor = rating != null
                          ? (rating <= 2
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : rating === 3
                                ? 'bg-slate-50 text-slate-700 border-slate-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200')
                          : ''
                        const isExternal = log.session_type === 'external'
                        const title = isExternal
                          ? log.external_name || log.external_category || 'Séance externe'
                          : `${log.programs?.name || 'Séance'} complétée`

                        return (
                          <div
                            key={log.id}
                            className="flex flex-col gap-3 p-5 transition-colors hover:bg-slate-50"
                          >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex items-start gap-4 min-w-0">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isExternal ? 'bg-blue-100/60' : 'bg-emerald-100/50'}`}>
                                  <History className={`h-5 w-5 ${isExternal ? 'text-blue-600' : 'text-emerald-600'}`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[15px] font-bold text-slate-900 truncate">{title}</p>
                                    {isExternal && (
                                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-100">
                                        Externe
                                      </span>
                                    )}
                                    {log.duration_minutes != null && (
                                      <span className="text-[11px] font-semibold text-slate-500">
                                        · {log.duration_minutes} min
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[13px] font-medium text-slate-500 mt-0.5">
                                    {new Date(log.completed_at).toLocaleDateString('fr-FR', {
                                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>

                              {ratingLabel && (
                                <span className={`shrink-0 rounded-lg border px-3 py-1 text-[11px] font-bold ${ratingColor}`}>
                                  {ratingLabel}
                                </span>
                              )}
                            </div>

                            {log.feedback_notes && (
                              <div className="ml-14 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                  Feedback du client
                                </p>
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                  {log.feedback_notes}
                                </p>
                              </div>
                            )}

                            {log.confirmation_photo_url && (
                              <a
                                href={log.confirmation_photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-14 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                              >
                                Voir la photo envoyée par le client →
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <EditClientDialog
        open={isEditDialogOpen}
        client={client}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleEditClient}
        isSubmitting={isSavingClient}
      />

      <AssignProgramDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        programs={coachPrograms}
        assignedProgramIds={assignedPrograms.map((program) => program.id)}
        onSubmit={handleAssignProgram}
        isSubmitting={isAssigningProgram}
      />

      <Dialog open={Boolean(sessionToEdit)} onOpenChange={(open) => !open && closeEditSessionDialog()}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-none p-0 shadow-xl overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold text-slate-900">Modifier la séance</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Changez le programme prévu, déplacez la séance à une autre date ou validez l&apos;annulation depuis la liste.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-session-program">Programme</Label>
              <Select value={editProgramId} onValueChange={setEditProgramId}>
                <SelectTrigger id="edit-session-program" className="h-10 w-full rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Choisir un programme" />
                </SelectTrigger>
                <SelectContent>
                  {scheduleProgramOptions.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-session-date">Date de séance</Label>
              <input
                id="edit-session-date"
                type="date"
                value={editScheduledDate}
                min={minSchedulableDate}
                onChange={(event) => setEditScheduledDate(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-offset-white transition focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-3xl border-slate-100 bg-slate-50/80 px-6 py-4">
            <Button type="button" variant="ghost" onClick={closeEditSessionDialog}>
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleUpdateSession}
              disabled={!sessionToEdit || !editProgramId || !editScheduledDate || isSchedulingSession}
              className="bg-[#10b981] font-bold text-white shadow-sm hover:bg-[#059669]"
            >
              {isSchedulingSession ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleSessionDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        selectedDate={scheduleTargetDate}
        programs={scheduleProgramOptions}
        onSubmit={handleScheduleSession}
        isSubmitting={isSchedulingSession}
      />

      {/* Cancel session confirmation */}
      <Dialog
        open={Boolean(sessionToCancel)}
        onOpenChange={(open) => !open && setSessionToCancel(null)}
      >
        <DialogContent className="sm:max-w-md rounded-3xl border-none p-6 bg-white">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">
              Annuler cette séance ?
            </DialogTitle>
            <DialogDescription className="text-center">
              {sessionToCancel ? (
                <>
                  La séance <strong>« {sessionToCancel.program_name} »</strong> du{' '}
                  <strong>
                    {new Date(sessionToCancel.scheduled_date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </strong>{' '}
                  sera marquée comme annulée. Le client en sera notifié.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setSessionToCancel(null)}
              disabled={isSchedulingSession}
              className="h-11 rounded-xl font-bold"
            >
              Garder
            </Button>
            <Button
              onClick={handleConfirmCancelSession}
              disabled={isSchedulingSession}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold gap-1.5"
            >
              {isSchedulingSession ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Annulation…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Annuler la séance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign confirmation */}
      <Dialog
        open={Boolean(programToUnassign)}
        onOpenChange={(open) => !open && setProgramToUnassign(null)}
      >
        <DialogContent className="sm:max-w-md rounded-3xl border-none p-6 bg-white">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">
              Désassigner ce programme ?
            </DialogTitle>
            <DialogDescription className="text-center">
              Le programme <strong>« {programToUnassign?.name} »</strong> ne sera plus assigné à
              <strong> {client.full_name || client.email}</strong>.<br />
              Toutes les séances planifiées (passées ou à venir) seront supprimées. L'historique
              des séances déjà réalisées ou annulées reste préservé.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setProgramToUnassign(null)}
              disabled={isUnassigningProgram}
              className="h-11 rounded-xl font-bold"
            >
              Annuler
            </Button>
            <Button
              onClick={handleUnassignProgram}
              disabled={isUnassigningProgram}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold gap-1.5"
            >
              {isUnassigningProgram ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Suppression…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Désassigner
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

interface CalendarStatCardProps {
  label: string
  value: number
  accent: 'slate' | 'primary' | 'amber' | 'emerald'
}

function CalendarStatCard({ label, value, accent }: CalendarStatCardProps) {
  const tones: Record<CalendarStatCardProps['accent'], { value: string; label: string }> = {
    slate: { value: 'text-slate-900', label: 'text-slate-500' },
    primary: { value: 'text-primary', label: 'text-primary/70' },
    amber: { value: 'text-amber-700', label: 'text-amber-600/80' },
    emerald: { value: 'text-emerald-700', label: 'text-emerald-600/80' },
  }
  const tone = tones[accent]

  return (
    <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200/60 shadow-sm">
      <p className={`text-[10px] font-extrabold uppercase tracking-wider ${tone.label}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tone.value}`}>{value}</p>
    </div>
  )
}
