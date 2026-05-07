import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Play,
  RefreshCcw,
  Sparkles,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useClientProfile } from '@/hooks/useClientProfile'
import { useClientCalendar, type ScheduledSession } from '@/hooks/useClientCalendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*  Date helpers                                                               */
/* -------------------------------------------------------------------------- */

const toDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const dateFromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const startOfWeekMonday = (date: Date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun, 1=Mon, ...
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d
}

const dayDiffKeys = (fromKey: string, toKey: string) => {
  const a = dateFromKey(fromKey)
  const b = dateFromKey(toKey)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

const formatLongDate = (key: string) => {
  const date = dateFromKey(key)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const formatShortDate = (key: string) => {
  const date = dateFromKey(key)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatRelativeFromToday = (key: string): string => {
  const todayKey = toDateKey(new Date())
  const diff = dayDiffKeys(todayKey, key)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  if (diff > 1 && diff <= 7) return `Dans ${diff} jours`
  if (diff < -1 && diff >= -7) return `Il y a ${Math.abs(diff)} jours`
  if (diff > 7) return `Dans ${Math.round(diff / 7)} semaines`
  return `Il y a ${Math.round(Math.abs(diff) / 7)} semaines`
}

const getShiftLabel = (coachKey: string, currentKey: string) => {
  const diff = dayDiffKeys(coachKey, currentKey)
  if (diff === 0) return 'Date inchangée'
  if (diff > 0) return `+${diff} jour${diff > 1 ? 's' : ''}`
  const abs = Math.abs(diff)
  return `-${abs} jour${abs > 1 ? 's' : ''}`
}

/* -------------------------------------------------------------------------- */
/*  Status visuals                                                             */
/* -------------------------------------------------------------------------- */

const formatStatus = (status?: string | null): { label: string; className: string } => {
  const s = String(status || 'planned').toLowerCase()
  if (s === 'completed') return { label: 'Terminée', className: 'bg-emerald-100 text-emerald-700 border-none' }
  if (s === 'cancelled') return { label: 'Annulée', className: 'bg-rose-100 text-rose-700 border-none' }
  if (s === 'skipped') return { label: 'Manquée', className: 'bg-amber-100 text-amber-700 border-none' }
  return { label: 'Planifiée', className: 'bg-primary/10 text-primary border-none' }
}

/* -------------------------------------------------------------------------- */
/*  Buckets for "À venir" tab                                                  */
/* -------------------------------------------------------------------------- */

interface SessionBucket {
  key: string
  label: string
  sessions: ScheduledSession[]
}

const buildUpcomingBuckets = (sessions: ScheduledSession[]): SessionBucket[] => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = toDateKey(today)
  const weekEnd = toDateKey(addDays(startOfWeekMonday(today), 6))
  const nextWeekStart = toDateKey(addDays(startOfWeekMonday(today), 7))
  const nextWeekEnd = toDateKey(addDays(startOfWeekMonday(today), 13))

  const upcoming = sessions
    .filter((s) => s.scheduled_date >= todayKey && String(s.status).toLowerCase() === 'planned')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

  const today_bucket = upcoming.filter((s) => s.scheduled_date === todayKey)
  const this_week_bucket = upcoming.filter((s) => s.scheduled_date > todayKey && s.scheduled_date <= weekEnd)
  const next_week_bucket = upcoming.filter((s) => s.scheduled_date >= nextWeekStart && s.scheduled_date <= nextWeekEnd)
  const later_bucket = upcoming.filter((s) => s.scheduled_date > nextWeekEnd)

  const buckets: SessionBucket[] = []
  if (today_bucket.length) buckets.push({ key: 'today', label: "Aujourd'hui", sessions: today_bucket })
  if (this_week_bucket.length) buckets.push({ key: 'this_week', label: 'Cette semaine', sessions: this_week_bucket })
  if (next_week_bucket.length) buckets.push({ key: 'next_week', label: 'Semaine prochaine', sessions: next_week_bucket })
  if (later_bucket.length) buckets.push({ key: 'later', label: 'Plus tard', sessions: later_bucket })
  return buckets
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ClientPlanningPage() {
  const navigate = useNavigate()
  const { client, loading: profileLoading } = useClientProfile()
  const {
    sessions,
    loading,
    saving,
    tableReady,
    rescheduleSessionByClient,
  } = useClientCalendar(client?.id)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpenMobile, setCalendarOpenMobile] = useState(false)
  const [sessionToEdit, setSessionToEdit] = useState<ScheduledSession | null>(null)
  const [candidateDate, setCandidateDate] = useState<Date | undefined>()

  const todayKey = toDateKey(new Date())
  const selectedDateKey = toDateKey(selectedDate)

  /* ── Buckets and groupings ── */

  const sessionsByDate = useMemo(() => {
    return sessions.reduce<Record<string, ScheduledSession[]>>((acc, s) => {
      if (!acc[s.scheduled_date]) acc[s.scheduled_date] = []
      acc[s.scheduled_date].push(s)
      return acc
    }, {})
  }, [sessions])

  const selectedDateSessions = sessionsByDate[selectedDateKey] || []

  const plannedDays = useMemo(
    () => sessions.filter((s) => String(s.status).toLowerCase() === 'planned').map((s) => dateFromKey(s.scheduled_date)),
    [sessions]
  )
  const completedDays = useMemo(
    () => sessions.filter((s) => String(s.status).toLowerCase() === 'completed').map((s) => dateFromKey(s.scheduled_date)),
    [sessions]
  )
  const skippedDays = useMemo(
    () => sessions.filter((s) => String(s.status).toLowerCase() === 'skipped').map((s) => dateFromKey(s.scheduled_date)),
    [sessions]
  )
  const cancelledDays = useMemo(
    () => sessions.filter((s) => String(s.status).toLowerCase() === 'cancelled').map((s) => dateFromKey(s.scheduled_date)),
    [sessions]
  )

  /* ── Stats ── */

  const stats = useMemo(() => {
    const upcoming = sessions.filter(
      (s) => s.scheduled_date >= todayKey && String(s.status).toLowerCase() === 'planned'
    ).length
    const todaysSession = sessions.some(
      (s) => s.scheduled_date === todayKey && String(s.status).toLowerCase() === 'planned'
    )
    const completed = sessions.filter((s) => String(s.status).toLowerCase() === 'completed').length
    const missed = sessions.filter(
      (s) => String(s.status).toLowerCase() === 'skipped' || (
        String(s.status).toLowerCase() === 'planned' && s.scheduled_date < todayKey
      )
    ).length

    return { upcoming, todaysSession, completed, missed }
  }, [sessions, todayKey])

  const nextUpcoming = useMemo(() => {
    return [...sessions]
      .filter((s) => s.scheduled_date >= todayKey && String(s.status).toLowerCase() === 'planned')
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0]
  }, [sessions, todayKey])

  const upcomingBuckets = useMemo(() => buildUpcomingBuckets(sessions), [sessions])

  const completedSessions = useMemo(
    () =>
      sessions
        .filter((s) => String(s.status).toLowerCase() === 'completed')
        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)),
    [sessions]
  )

  const allSorted = useMemo(
    () => [...sessions].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)),
    [sessions]
  )

  const shiftedSessionsCount = useMemo(
    () => sessions.filter((s) => s.scheduled_date !== s.coach_scheduled_date).length,
    [sessions]
  )

  /* ── Reschedule dialog ── */

  const openRescheduleDialog = (session: ScheduledSession) => {
    setSessionToEdit(session)
    setCandidateDate(dateFromKey(session.scheduled_date))
  }

  const closeRescheduleDialog = () => {
    setSessionToEdit(null)
    setCandidateDate(undefined)
  }

  const isDateInAllowedWindow = (date: Date) => {
    if (!sessionToEdit) return false
    const coachDate = dateFromKey(sessionToEdit.coach_scheduled_date)
    const minDate = addDays(coachDate, -3)
    const maxDate = addDays(coachDate, 3)
    return date >= minDate && date <= maxDate
  }

  const handleConfirmReschedule = async () => {
    if (!sessionToEdit || !candidateDate) return
    try {
      await rescheduleSessionByClient({
        sessionId: sessionToEdit.id,
        scheduledDate: toDateKey(candidateDate),
      })
      toast.success('Date de séance mise à jour.')
      closeRescheduleDialog()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de modifier la date de séance.'
      toast.error(message)
    }
  }

  if (profileLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">Planning</h1>
        <p className="text-sm text-muted-foreground">
          Vue globale de toutes tes séances prévues par ton coach.
        </p>
      </div>

      {!tableReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Le planning n&apos;est pas disponible pour le moment (table <code>scheduled_sessions</code> absente).
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="À venir"
          value={stats.upcoming}
          icon={<CalendarClock className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Aujourd'hui"
          value={stats.todaysSession ? '1' : '—'}
          icon={<Sparkles className="h-4 w-4" />}
          accent={stats.todaysSession ? 'primary' : 'muted'}
        />
        <StatCard
          label="Terminées"
          value={stats.completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Manquées"
          value={stats.missed}
          icon={<CalendarX className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      {/* All sessions with tabs (now at top) */}
      <Card className="border-border/40 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" />
            Toutes les séances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] px-3 py-8 text-center">
              <p className="text-sm font-medium text-slate-600">Ton coach n&apos;a pas encore planifié de séance.</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/client/coach')}
                className="mt-3 h-9 gap-1.5 text-xs font-bold text-primary hover:bg-primary/10"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Demander à mon coach
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100 p-1 sm:w-auto">
                <TabsTrigger value="upcoming" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  À venir ({stats.upcoming})
                </TabsTrigger>
                <TabsTrigger value="completed" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  Réalisées ({completedSessions.length})
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  Toutes ({sessions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="mt-4 space-y-5">
                {upcomingBuckets.length === 0 ? (
                  <EmptyTab message="Aucune séance à venir." />
                ) : (
                  upcomingBuckets.map((bucket) => (
                    <div key={bucket.key} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                          {bucket.label}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400">
                          · {bucket.sessions.length}
                        </span>
                        <div className="ml-auto h-px flex-1 bg-slate-200/60" />
                      </div>
                      <div className="space-y-2">
                        {bucket.sessions.map((session) => (
                          <SessionRow
                            key={session.id}
                            session={session}
                            todayKey={todayKey}
                            saving={saving}
                            tableReady={tableReady}
                            onLaunch={() => navigate(`/client/workout/${session.program_id}`)}
                            onReschedule={() => openRescheduleDialog(session)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-4 space-y-2">
                {completedSessions.length === 0 ? (
                  <EmptyTab message="Aucune séance terminée pour le moment." />
                ) : (
                  completedSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      todayKey={todayKey}
                      saving={saving}
                      tableReady={tableReady}
                      onLaunch={() => navigate(`/client/workout/${session.program_id}`)}
                      onReschedule={() => openRescheduleDialog(session)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-4 space-y-2">
                {allSorted.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    todayKey={todayKey}
                    saving={saving}
                    tableReady={tableReady}
                    onLaunch={() => navigate(`/client/workout/${session.program_id}`)}
                    onReschedule={() => openRescheduleDialog(session)}
                  />
                ))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Calendar + Right panel (Prochaine séance + day details) */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[1.7fr_1fr]">
        {/*
          Calendar card — collapsible on mobile (toggle), always visible on lg+
        */}
        <Card className="border-border/40 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setCalendarOpenMobile((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 lg:cursor-default lg:px-6 lg:py-4"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendrier
            </span>
            <div className="flex items-center gap-2">
              <span
                role="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedDate(new Date())
                  setCalendarOpenMobile(true)
                }}
                className="h-7 inline-flex items-center gap-1 rounded-md px-2 text-[11px] font-bold text-primary hover:bg-primary/10"
              >
                Aujourd'hui
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 lg:hidden">
                {calendarOpenMobile ? 'Masquer' : 'Afficher'}
              </span>
            </div>
          </button>
          <div className={`${calendarOpenMobile ? 'block' : 'hidden'} space-y-4 px-4 pb-4 lg:block lg:px-6 lg:pb-6`}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{
                planned: plannedDays,
                completed: completedDays,
                skipped: skippedDays,
                cancelled: cancelledDays,
              }}
              modifiersClassNames={{
                planned: 'relative bg-primary/10 text-primary font-bold after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary',
                completed: 'relative bg-emerald-200/50 text-emerald-800 font-bold after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-emerald-600',
                skipped: 'relative bg-amber-100 text-amber-800 font-bold after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-amber-600',
                cancelled: 'relative bg-rose-100 text-rose-700 font-bold line-through after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-rose-500',
              }}
              className="w-full rounded-xl border border-slate-100 [--cell-size:3.25rem]"
              classNames={{ root: 'w-full' }}
            />

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 px-1 text-[11px] font-medium text-slate-600 sm:grid-cols-4">
              <LegendItem dotClass="bg-primary" label="Prévue" />
              <LegendItem dotClass="bg-emerald-600" label="Terminée" />
              <LegendItem dotClass="bg-amber-600" label="Manquée" />
              <LegendItem dotClass="bg-rose-500" label="Annulée" />
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{sessions.length} séance{sessions.length > 1 ? 's' : ''} au total</p>
              {shiftedSessionsCount > 0 && (
                <p className="mt-1 text-amber-700">
                  {shiftedSessionsCount} séance{shiftedSessionsCount > 1 ? 's' : ''} déplacée{shiftedSessionsCount > 1 ? 's' : ''} par toi
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Right column: Prochaine séance + Day details */}
        <div className="space-y-4">
          {/* Prochaine séance hero */}
          {nextUpcoming ? (
            <NextSessionBanner
              session={nextUpcoming}
              onLaunch={() => navigate(`/client/workout/${nextUpcoming.program_id}`)}
            />
          ) : (
            <Card className="border-2 border-dashed border-primary/30 bg-primary/[0.03] shadow-none">
              <CardContent className="flex flex-col items-center justify-center px-4 py-6 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-bold text-slate-700">Aucune séance à venir</p>
                <p className="mt-1 text-xs text-slate-500">
                  Demande à ton coach quand tu seras prêt.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/client/coach')}
                  className="mt-3 h-9 gap-1.5 rounded-xl border-primary/30 font-bold text-primary hover:bg-primary/5"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Mon coach
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Day details (selected date) */}
          <Card className="border-border/40 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-sm font-semibold">
                <DateChip date={selectedDate} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-slate-900 capitalize leading-tight">
                    {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500">
                    {selectedDateSessions.length === 0
                      ? 'Aucune séance ce jour'
                      : `${selectedDateSessions.length} séance${selectedDateSessions.length > 1 ? 's' : ''}`}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {selectedDateSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                  <CalendarDays className="mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-500">
                    {selectedDateKey < todayKey
                      ? "Tu n'avais rien de prévu ce jour-là."
                      : 'Profite-en pour récupérer.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      todayKey={todayKey}
                      saving={saving}
                      tableReady={tableReady}
                      onLaunch={() => navigate(`/client/workout/${session.program_id}`)}
                      onReschedule={() => openRescheduleDialog(session)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={Boolean(sessionToEdit)} onOpenChange={(open) => !open && closeRescheduleDialog()}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 pt-6 pb-5 text-white">
            <DialogTitle className="text-xl font-black text-white">Déplacer la séance</DialogTitle>
            <DialogDescription className="text-xs font-medium text-white/85">
              Tu peux choisir une date dans une fenêtre de ±3 jours autour du planning du coach.
            </DialogDescription>
          </DialogHeader>

          {sessionToEdit && (
            <div className="space-y-3 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">{sessionToEdit.program_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Date initiale : {formatLongDate(sessionToEdit.coach_scheduled_date)}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  Fenêtre : {formatShortDate(toDateKey(addDays(dateFromKey(sessionToEdit.coach_scheduled_date), -3)))} → {formatShortDate(toDateKey(addDays(dateFromKey(sessionToEdit.coach_scheduled_date), 3)))}
                </p>
              </div>

              <Calendar
                mode="single"
                selected={candidateDate}
                onSelect={(date) => {
                  if (date && isDateInAllowedWindow(date)) setCandidateDate(date)
                }}
                disabled={(date) => !isDateInAllowedWindow(date)}
                className="rounded-xl border border-slate-100"
              />
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-4">
            <Button
              variant="outline"
              onClick={closeRescheduleDialog}
              className="h-11 rounded-xl font-bold"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmReschedule}
              disabled={!sessionToEdit || !candidateDate || saving}
              className="h-11 rounded-xl bg-primary font-bold hover:bg-primary/90"
            >
              {saving ? 'Enregistrement…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function NextSessionBanner({
  session,
  onLaunch,
}: {
  session: ScheduledSession
  onLaunch: () => void
}) {
  const todayKey = toDateKey(new Date())
  const diff = dayDiffKeys(todayKey, session.scheduled_date)
  const isImminent = diff <= 1

  return (
    <Card
      className={cn(
        'overflow-hidden border-none shadow-md',
        isImminent
          ? 'bg-gradient-to-br from-primary via-emerald-500 to-emerald-600 text-white shadow-primary/30'
          : 'bg-white ring-1 ring-slate-200/60'
      )}
    >
      <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl',
              isImminent ? 'bg-white/20 ring-1 ring-white/30 backdrop-blur' : 'bg-primary/10'
            )}
          >
            <span
              className={cn(
                'text-[10px] font-extrabold uppercase tracking-wider',
                isImminent ? 'text-white/90' : 'text-primary'
              )}
            >
              {dateFromKey(session.scheduled_date).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
            </span>
            <span
              className={cn(
                'text-base font-black leading-none',
                isImminent ? 'text-white' : 'text-primary'
              )}
            >
              {dateFromKey(session.scheduled_date).getDate()}
            </span>
          </div>
          <div>
            <p
              className={cn(
                'text-[10px] font-extrabold uppercase tracking-widest',
                isImminent ? 'text-white/80' : 'text-primary'
              )}
            >
              Prochaine séance · {formatRelativeFromToday(session.scheduled_date)}
            </p>
            <h3 className={cn('text-lg font-black leading-tight', isImminent ? 'text-white' : 'text-slate-900')}>
              {session.program_name}
            </h3>
            <p
              className={cn(
                'mt-0.5 text-xs font-medium capitalize',
                isImminent ? 'text-white/80' : 'text-slate-500'
              )}
            >
              {formatLongDate(session.scheduled_date)}
            </p>
          </div>
        </div>

        <Button
          onClick={onLaunch}
          size="lg"
          className={cn(
            'h-11 gap-2 rounded-xl font-bold shadow-sm',
            isImminent
              ? 'bg-white text-primary hover:bg-white/90'
              : 'bg-primary text-white hover:bg-primary/90'
          )}
        >
          {diff === 0 ? (
            <>
              <Play className="h-4 w-4 fill-current" />
              Démarrer maintenant
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              Voir l'aperçu
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  accent: 'primary' | 'emerald' | 'amber' | 'muted'
}) {
  const tones: Record<typeof accent, { iconBg: string; iconColor: string; valueColor: string }> = {
    primary: { iconBg: 'bg-primary/10', iconColor: 'text-primary', valueColor: 'text-slate-900' },
    emerald: { iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700', valueColor: 'text-slate-900' },
    amber: { iconBg: 'bg-amber-100', iconColor: 'text-amber-700', valueColor: 'text-slate-900' },
    muted: { iconBg: 'bg-slate-100', iconColor: 'text-slate-500', valueColor: 'text-slate-400' },
  }
  const t = tones[accent]

  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/60 shadow-sm">
      <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', t.iconBg, t.iconColor)}>
        {icon}
      </div>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-black tabular-nums', t.valueColor)}>{value}</p>
    </div>
  )
}

function DateChip({ date }: { date: Date }) {
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
      <span className="text-[10px] font-extrabold uppercase tracking-wider">
        {date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
      </span>
      <span className="text-base font-black leading-none">{date.getDate()}</span>
    </div>
  )
}

function LegendItem({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      <span>{label}</span>
    </div>
  )
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  )
}

function SessionRow({
  session,
  todayKey,
  saving,
  tableReady,
  onLaunch,
  onReschedule,
}: {
  session: ScheduledSession
  todayKey: string
  saving: boolean
  tableReady: boolean
  onLaunch: () => void
  onReschedule: () => void
}) {
  const statusInfo = formatStatus(session.status)
  const status = String(session.status || 'planned').toLowerCase()
  const isShifted = session.scheduled_date !== session.coach_scheduled_date
  const canLaunchToday = status === 'planned' && session.scheduled_date === todayKey
  const canReschedule = status === 'planned' && session.scheduled_date >= todayKey
  const isMissed = status === 'planned' && session.scheduled_date < todayKey

  return (
    <Card className="border-none bg-white p-3.5 shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Mini date */}
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
              {dateFromKey(session.scheduled_date).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
            </span>
            <span className="text-base font-black leading-none">
              {dateFromKey(session.scheduled_date).getDate()}
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate text-sm font-bold text-slate-900">{session.program_name}</p>
              <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
              {isMissed && (
                <Badge className="bg-amber-100 text-amber-700 border-none">À reprogrammer</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 capitalize">
              {formatLongDate(session.scheduled_date)} ·{' '}
              <span className="font-semibold text-slate-700">
                {formatRelativeFromToday(session.scheduled_date)}
              </span>
            </p>
            {isShifted && (
              <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                Déplacée {getShiftLabel(session.coach_scheduled_date, session.scheduled_date)} (initialement le {formatShortDate(session.coach_scheduled_date)})
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {canLaunchToday && (
            <Button
              size="sm"
              onClick={onLaunch}
              className="h-9 gap-1.5 rounded-lg bg-primary font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Démarrer
            </Button>
          )}
          {!canLaunchToday && status === 'planned' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLaunch}
              className="h-9 gap-1.5 rounded-lg border-primary/30 font-bold text-primary hover:bg-primary/5"
            >
              Aperçu
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {canReschedule && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReschedule}
              disabled={saving || !tableReady}
              className="h-9 gap-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              title="Déplacer ±3 jours"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Déplacer
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
