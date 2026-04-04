import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Calendar as CalendarIcon, History, Plus, MoreHorizontal, MessageSquare, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
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

  const { updateClient, saving: isSavingClient } = useCoachClients()
  const { programs: coachPrograms } = useCoachPrograms(true)
  const { assigning: isAssigningProgram, assignProgramToClient } = useClientProgramAssignments()
  const {
    sessions: scheduledSessions,
    loading: isCalendarLoading,
    saving: isSchedulingSession,
    tableReady: isCalendarTableReady,
    scheduleSession,
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

  const isPastDate = (date: Date) => date < startOfToday()

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
    openScheduleDialogForDate(date)
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
      <div className="flex min-h-[100dvh] flex-col bg-slate-50 relative pb-24 lg:pb-0">
        <div className="sticky top-0 z-30 border-b border-border/40 bg-white/95 backdrop-blur-lg px-4 py-4 lg:px-8 shadow-sm">
          <div className="mx-auto max-w-7xl">
            <button
              onClick={() => navigate('/coach/clients')}
              className="group mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-slate-200">
                <ArrowLeft className="h-4 w-4" />
              </div>
              Retour à la liste
            </button>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-2 border-slate-100 ring-4 ring-white shadow-lg">
                  <AvatarImage src={client.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/5 text-xl font-bold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">{client.full_name || client.email}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {client.age ? `${client.age} ans` : 'Âge N/A'}</span>
                    <span>•</span>
                    <span>{client.main_goal || 'Objectif non défini'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2 rounded-xl text-slate-600 bg-white hover:bg-slate-50 border-slate-200 font-semibold shadow-sm">
                  <MessageSquare className="h-4 w-4" /> Message
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="gap-2 rounded-xl text-slate-600 bg-white hover:bg-slate-50 border-slate-200 font-semibold shadow-sm"
                >
                  <Pencil className="h-4 w-4" /> Modifier les infos
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/60 sm:w-[480px]">
                <TabsTrigger value="programs" className="rounded-xl text-sm font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">Programmes</TabsTrigger>
                <TabsTrigger value="calendar" className="rounded-xl text-sm font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">Calendrier</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl text-sm font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">Historique</TabsTrigger>
              </TabsList>

              <TabsContent value="programs" className="mt-8 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Programmes Assignés</h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAssignDialogOpen(true)}
                      className="rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Assigner un programme existant
                    </Button>
                    <Button
                      onClick={() => navigate(`/coach/programs/builder?clientId=${client.id}`)}
                      className="bg-[#10b981] font-bold text-white shadow-lg hover:bg-[#059669] rounded-xl gap-2 h-10 px-5"
                    >
                      <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Créer un programme sur-mesure</span><span className="inline sm:hidden">Créer</span>
                    </Button>
                  </div>
                </div>

                {assignedPrograms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center ring-1 ring-slate-200/30">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <History className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Aucun programme assigné</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500 max-w-sm">
                      Ce client n'a pas encore de programme d'entraînement. Cliquez sur un des boutons ci-dessus pour commencer.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {assignedPrograms.map((program) => {
                      const progressRows = sessionProgressByProgram.get(program.id) || []
                      const completedCount = progressRows.filter((row) => row.is_done).length
                      const hasProgress = progressRows.length > 0

                      return (
                        <Card
                          key={program.id}
                          onClick={() => navigate(`/coach/programs/builder?programId=${program.id}&clientId=${client.id}`)}
                          className="group border-none bg-white p-6 shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-md cursor-pointer hover:ring-primary/30"
                        >
                          <div className="mb-4 flex items-start justify-between">
                            <Badge variant="secondary" className="bg-[#10b981]/15 text-[#10b981] font-bold border-none uppercase tracking-wider text-[10px]">
                              Assigné
                            </Badge>
                            <button className="text-slate-400 hover:text-slate-900 transition-colors">
                              <MoreHorizontal className="h-5 w-5" />
                            </button>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">{program.name}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">
                            {program.description || 'Appuyez pour voir les détails du programme.'}
                          </p>

                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {formatProgramRange(program.start_date, program.end_date)}
                          </div>

                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Avancement des séances
                              </p>
                              {hasProgress && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold">
                                  {completedCount}/{progressRows.length} faites
                                </Badge>
                              )}
                            </div>

                            {!isCalendarTableReady ? (
                              <p className="mt-2 text-xs text-amber-700">
                                Planification indisponible (table scheduled_sessions absente).
                              </p>
                            ) : isCalendarLoading ? (
                              <p className="mt-2 text-xs text-slate-500">Chargement des séances planifiées...</p>
                            ) : !hasProgress ? (
                              <p className="mt-2 text-xs text-slate-500">Aucune séance planifiée pour ce programme.</p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {progressRows.slice(0, 4).map((row) => (
                                  <div
                                    key={row.session_id}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-semibold text-slate-700">
                                        Prévue coach le {formatShortDate(row.coach_scheduled_date)}
                                      </p>
                                      {row.scheduled_date !== row.coach_scheduled_date && (
                                        <p className="text-[10px] text-amber-700 font-medium">
                                          Client déplacée au {formatShortDate(row.scheduled_date)}
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
                                        ? 'bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold'
                                        : 'bg-amber-100 text-amber-700 border-none text-[10px] font-bold'}
                                    >
                                      {row.is_done ? 'Fait' : 'Non fait'}
                                    </Badge>
                                  </div>
                                ))}

                                {progressRows.length > 4 && (
                                  <p className="text-[10px] text-slate-500">
                                    +{progressRows.length - 4} autre(s) séance(s)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="calendar" className="mt-8">
                <div className="grid gap-8 lg:grid-cols-[minmax(460px,540px)_1fr] items-start">
                  <Card className="border-none bg-white shadow-sm ring-1 ring-slate-200/60 p-5 rounded-3xl w-full mx-auto lg:mx-0">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900">Planning des séances</h3>
                      <Button
                        variant="outline"
                        onClick={() => openScheduleDialogForDate(selectedDate)}
                        disabled={isPastDate(selectedDate) || !isCalendarTableReady}
                        className="rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" /> Planifier une séance
                      </Button>
                    </div>

                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleCalendarDateSelect}
                      className="rounded-xl border-0 w-full [--cell-size:3rem]"
                      classNames={{ root: 'w-full' }}
                      disabled={(date) => isPastDate(date)}
                      modifiers={{
                        scheduled: scheduledDays,
                      }}
                      modifiersClassNames={{
                        scheduled: 'bg-primary/15 text-primary font-bold',
                      }}
                      modifiersStyles={{
                        disabled: { color: '#94a3b8', textDecoration: 'line-through' },
                      }}
                    />

                    {!isCalendarTableReady && (
                      <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-700">
                        La table <strong>scheduled_sessions</strong> n'est pas disponible. Exécutez la migration
                        <span className="ml-1 font-semibold">supabase/safe_scheduled_sessions.sql</span>.
                      </div>
                    )}
                  </Card>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h3>
                    </div>

                    {isCalendarLoading ? (
                      <div className="bg-white rounded-3xl p-8 ring-1 ring-slate-200/60 shadow-sm text-sm font-medium text-slate-500">
                        Chargement des séances planifiées...
                      </div>
                    ) : selectedDateSessions.length === 0 ? (
                      <div className="bg-white rounded-3xl p-8 ring-1 ring-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100">
                        <CalendarIcon className="h-10 w-10 text-slate-300 mb-4" />
                        <p className="text-sm font-bold text-slate-900">Aucune séance planifiée ce jour</p>
                        <p className="text-xs text-slate-500 mt-1 mb-5">
                          Cliquez sur la date ou sur le bouton “Planifier une séance”.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => openScheduleDialogForDate(selectedDate)}
                          disabled={isPastDate(selectedDate) || !isCalendarTableReady}
                          className="shadow-sm border-slate-200 font-semibold gap-2 rounded-xl text-slate-700 bg-slate-50 hover:bg-slate-100"
                        >
                          <Plus className="h-4 w-4" /> Planifier une séance
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/60 shadow-sm space-y-3">
                        <p className="text-sm font-bold text-slate-900">Séances planifiées ({selectedDateSessions.length})</p>
                        {selectedDateSessions.map((session) => (
                          <div
                            key={session.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{session.program_name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Programme planifié</p>
                            </div>
                            <Badge className="bg-primary/10 text-primary border-none capitalize">{session.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-8 space-y-4">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Journal d'Activité</h2>

                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                  {logs.length === 0 ? (
                    <div className="p-8 text-center text-sm font-medium text-slate-500">
                      Aucun historique de séance complétée pour le moment.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-6 transition-colors hover:bg-slate-50">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100/50">
                              <History className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-slate-900">{log.programs?.name || 'Séance'} complétée</p>
                              <p className="text-[13px] font-medium text-slate-500">
                                {new Date(log.completed_at).toLocaleDateString('fr-FR', {
                                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="font-bold text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl hidden sm:flex">
                            Voir Détails
                          </Button>
                        </div>
                      ))}
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

      <ScheduleSessionDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        selectedDate={scheduleTargetDate}
        programs={scheduleProgramOptions}
        onSubmit={handleScheduleSession}
        isSubmitting={isSchedulingSession}
      />
    </>
  )
}
