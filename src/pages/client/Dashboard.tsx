import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useClientProfile } from '@/hooks/useClientProfile'
import { useClientDashboard } from '@/hooks/useClientDashboard'
import type { ClientProgram, WorkoutLog } from '@/hooks/useClientDashboard'
import { useClientCalendar, type ScheduledSession } from '@/hooks/useClientCalendar'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Clock,
  Flame,
  Calendar,
  TrendingUp,
  ChevronRight,
  Dumbbell,
  Sparkles,
  MessageCircle,
  Trophy,
  Target,
} from 'lucide-react'

export default function ClientDashboard() {
  const { user } = useAuth()
  const { client, loading: clientLoading } = useClientProfile()
  const { assignedPrograms, activeProgram, workoutLogs, totalWorkouts, thisWeekWorkouts, loading, error } =
    useClientDashboard(client?.id)
  const {
    sessions: scheduledSessions,
    loading: scheduledSessionsLoading,
    tableReady: isScheduledSessionsReady,
  } = useClientCalendar(client?.id)

  const assignedProgramByProgramId = useMemo(() => {
    const map = new Map<string, ClientProgram>()
    assignedPrograms.forEach((assignment) => {
      map.set(String(assignment.program_id), assignment)
    })
    return map
  }, [assignedPrograms])

  const thisWeekRange = useMemo(() => getWeekRange(new Date()), [])

  const thisWeekScheduledSessions = useMemo(() => {
    return scheduledSessions.filter((session) => {
      const date = dateFromKey(session.scheduled_date)
      return date >= thisWeekRange.start && date <= thisWeekRange.end && session.status !== 'cancelled'
    })
  }, [scheduledSessions, thisWeekRange])

  const nextScheduledSession = useMemo(() => {
    const todayKey = toDateKey(new Date())
    return scheduledSessions.find((session) => session.scheduled_date >= todayKey) || null
  }, [scheduledSessions])

  const todayKey = useMemo(() => toDateKey(new Date()), [])

  const todayScheduledSessions = useMemo(() => {
    return scheduledSessions.filter((session) => session.scheduled_date === todayKey && session.status !== 'cancelled')
  }, [scheduledSessions, todayKey])

  const todayPrimarySession = todayScheduledSessions[0] || null

  const todayScheduledProgram = todayPrimarySession
    ? assignedProgramByProgramId.get(String(todayPrimarySession.program_id)) || null
    : null

  const heroProgram = todayScheduledProgram || activeProgram

  if (clientLoading || loading) {
    return <DashboardSkeleton />
  }

  const firstName = client?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Athlète'

  const today = new Date()
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const dateString = `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]}`

  const subtitle = (() => {
    if (!isScheduledSessionsReady) {
      return `${dateString} • Planification indisponible pour le moment.`
    }

    if (todayScheduledSessions.length === 1 && todayPrimarySession) {
      return `${dateString} • Séance planifiée aujourd'hui : ${todayPrimarySession.program_name}.`
    }

    if (todayScheduledSessions.length > 1) {
      return `${dateString} • ${todayScheduledSessions.length} séances planifiées aujourd'hui.`
    }

    if (nextScheduledSession) {
      return `${dateString} • Prochaine séance le ${formatShortDate(dateFromKey(nextScheduledSession.scheduled_date))} : ${nextScheduledSession.program_name}.`
    }

    return `${dateString} • Aucune séance planifiée pour l'instant.`
  })()

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground lg:text-2xl">
          Prêt pour ta séance, {firstName} ?
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground lg:text-sm">
          {subtitle}
        </p>
      </div>

      {/*
        ── Mobile-first layout (single column on small screens) ──
        On mobile we keep only the essentials and reorder for hierarchy.
        On lg+ we restore the historical 2/3-1/3 grid.
      */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* MAIN COLUMN */}
        <div className="space-y-5 lg:col-span-2">
          {/* Hero Workout Card */}
          {heroProgram ? (
            <ActiveWorkoutCard
              program={heroProgram}
              logs={workoutLogs}
              isPlannedToday={Boolean(todayPrimarySession && String(heroProgram.program_id) === String(todayPrimarySession.program_id))}
            />
          ) : (
            <EmptyProgramState />
          )}

          {/* Weekly Progress */}
          <WeeklyProgressSection
            thisWeekWorkouts={thisWeekWorkouts}
            thisWeekScheduledWorkouts={thisWeekScheduledSessions.length}
            totalWorkouts={totalWorkouts}
            activeProgram={activeProgram}
          />

          {/* Mobile-only: Upcoming sessions appears here for hierarchy */}
          <div className="lg:hidden">
            <UpcomingSessions
              sessions={scheduledSessions}
              loading={scheduledSessionsLoading}
              tableReady={isScheduledSessionsReady}
              assignedPrograms={assignedPrograms}
            />
          </div>

          {/* Coach banner (desktop) — hidden on mobile to reduce noise */}
          <div className="hidden lg:block">
            <CoachBanner nextSession={nextScheduledSession} />
          </div>

          {/* Mobile-only: Recent activity (compact) */}
          <div className="lg:hidden">
            <RecentActivity logs={workoutLogs.slice(0, 3)} />
          </div>
        </div>

        {/* RIGHT COLUMN — desktop only */}
        <div className="hidden space-y-5 lg:block">
          <UpcomingSessions
            sessions={scheduledSessions}
            loading={scheduledSessionsLoading}
            tableReady={isScheduledSessionsReady}
            assignedPrograms={assignedPrograms}
          />

          <CoachTip
            thisWeekWorkouts={thisWeekWorkouts}
            thisWeekScheduledWorkouts={thisWeekScheduledSessions.length}
          />

          <RecentActivity logs={workoutLogs.slice(0, 3)} />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function ActiveWorkoutCard({
  program,
  logs,
  isPlannedToday,
}: {
  program: ClientProgram
  logs: WorkoutLog[]
  isPlannedToday: boolean
}) {
  const navigate = useNavigate()
  const progress = program.progress_percentage || 0
  const exerciseCount = program.programs?.exercises?.length || 0

  const lastProgramLog = logs.find((log) => String(log.program_id) === String(program.program_id))
  const durationLabel = lastProgramLog?.duration_minutes ? `${lastProgramLog.duration_minutes} min` : 'Durée variable'
  const caloriesLabel = lastProgramLog?.calories_burned
    ? `~${Math.round(lastProgramLog.calories_burned)} kcal`
    : 'kcal —'

  return (
    <Card className="group relative overflow-hidden border-none bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-xl">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />

      <CardContent className="relative z-10 p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge className="bg-primary/90 text-white text-[10px] font-semibold uppercase tracking-wider border-none shadow-sm">
            {isPlannedToday ? "Aujourd'hui" : 'Programme actif'}
          </Badge>
          {program.programs?.difficulty && (
            <Badge variant="outline" className="border-white/30 text-white/90 text-[10px] uppercase tracking-wider">
              {program.programs.difficulty}
            </Badge>
          )}
        </div>

        <h2 className="text-xl font-bold leading-tight lg:text-2xl">
          {program.programs?.name || 'Séance du jour'}
        </h2>

        {program.programs?.description && (
          <p className="mt-1.5 text-sm text-white/70 line-clamp-2">
            {program.programs.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm text-white/80">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{durationLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4" />
            <span>{caloriesLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dumbbell className="h-4 w-4" />
            <span>{exerciseCount} exercices</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>Progression</span>
              <span className="font-semibold text-white/90">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-white/15 [&>div]:bg-primary" />
          </div>
          <Button
            size="lg"
            onClick={() => navigate(`/client/workout/${program.program_id}`)}
            className="ml-4 gap-2 rounded-xl bg-primary px-5 text-sm font-semibold shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40"
          >
            Lancer la séance
            <Play className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyProgramState() {
  const navigate = useNavigate()
  return (
    <Card className="border-dashed border-primary/30 bg-white">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Pas encore de programme assigné
        </h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Tu peux demander un programme personnalisé à ton coach en quelques secondes.
        </p>
        <div className="mt-5 flex w-full max-w-xs flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => navigate('/client/coach')}
            className="h-11 flex-1 gap-1.5 rounded-xl bg-primary font-bold shadow-sm shadow-primary/20 hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            Demander un programme
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/client/messages')}
            className="h-11 flex-1 gap-1.5 rounded-xl border-primary/30 font-bold text-primary hover:bg-primary/5"
          >
            <MessageCircle className="h-4 w-4" />
            Message
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function WeeklyProgressSection({
  thisWeekWorkouts,
  thisWeekScheduledWorkouts,
  totalWorkouts,
  activeProgram,
}: {
  thisWeekWorkouts: number
  thisWeekScheduledWorkouts: number
  totalWorkouts: number
  activeProgram: ClientProgram | null
}) {
  const weeklyProgress =
    thisWeekScheduledWorkouts > 0
      ? Math.round((thisWeekWorkouts / thisWeekScheduledWorkouts) * 100)
      : 0

  const stats = [
    {
      label: 'Séances cette semaine',
      value: thisWeekWorkouts.toString(),
      sub:
        thisWeekScheduledWorkouts > 0
          ? `sur ${thisWeekScheduledWorkouts} prévues`
          : 'aucune planifiée',
      trend: weeklyProgress >= 75 ? '+' : null,
      icon: Calendar,
    },
    {
      label: 'Total séances',
      value: totalWorkouts.toString(),
      sub: 'depuis le début',
      trend: null,
      icon: Trophy,
    },
    {
      label: 'Programme actuel',
      value: activeProgram ? `${activeProgram.progress_percentage || 0}%` : '—',
      sub: activeProgram?.programs?.name || 'Aucun',
      trend: (activeProgram?.progress_percentage || 0) > 0 ? '+' : null,
      icon: Target,
    },
  ]

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 lg:text-sm lg:font-semibold lg:normal-case lg:tracking-normal lg:text-foreground">
          Ton évolution cette semaine
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/40 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-3 lg:p-4">
              <div className="mb-2 flex items-center justify-between lg:mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 lg:h-8 lg:w-8">
                  <stat.icon className="h-3.5 w-3.5 text-primary lg:h-4 lg:w-4" />
                </div>
                {stat.trend && (
                  <Badge variant="outline" className="hidden border-primary/20 bg-primary/5 text-primary text-[10px] lg:inline-flex">
                    <TrendingUp className="mr-0.5 h-3 w-3" />
                    En hausse
                  </Badge>
                )}
              </div>
              <p className="text-xl font-extrabold tabular-nums tracking-tight text-foreground lg:text-2xl">
                {stat.value}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground lg:text-xs">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function UpcomingSessions({
  sessions,
  loading,
  tableReady,
  assignedPrograms,
}: {
  sessions: ScheduledSession[]
  loading: boolean
  tableReady: boolean
  assignedPrograms: ClientProgram[]
}) {
  const navigate = useNavigate()
  const [selectedSessionId, setSelectedSessionId] = useState<string | number | null>(null)

  const todayKey = useMemo(() => toDateKey(new Date()), [])

  const upcoming = useMemo(() => {
    return sessions
      .filter((session) => session.scheduled_date >= todayKey)
      .slice(0, 6)
  }, [sessions, todayKey])

  const programById = useMemo(() => {
    const map = new Map<string, ClientProgram['programs']>()
    assignedPrograms.forEach((assignment) => {
      if (assignment.programs) {
        map.set(String(assignment.program_id), assignment.programs)
      }
    })
    return map
  }, [assignedPrograms])

  const selectedSession = useMemo(() => {
    if (selectedSessionId === null) return null
    return upcoming.find((session) => String(session.id) === String(selectedSessionId)) || null
  }, [selectedSessionId, upcoming])

  const selectedProgram = selectedSession
    ? programById.get(String(selectedSession.program_id)) || null
    : null

  const selectedExercises = useMemo(() => {
    if (!selectedProgram?.exercises) return []

    return [...selectedProgram.exercises]
      .filter((exercise) => !exercise.is_section_header)
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
  }, [selectedProgram])

  const closeDetails = () => setSelectedSessionId(null)

  return (
    <>
      <Card className="border-border/40 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-primary" />
            Sessions prévues
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-1 px-4 pb-4">
          {loading ? (
            <p className="rounded-xl bg-muted/40 px-3 py-3 text-xs text-muted-foreground">Chargement des sessions…</p>
          ) : !tableReady ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
              Planification indisponible pour le moment.
            </p>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Aucune séance planifiée à venir.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.assign('/client/planning')}
                className="mt-2 h-8 gap-1 text-xs font-bold text-primary hover:bg-primary/10"
              >
                <Calendar className="h-3 w-3" />
                Voir mon planning
              </Button>
            </div>
          ) : (
            upcoming.map((session) => {
              const date = dateFromKey(session.scheduled_date)
              const isToday = session.scheduled_date === todayKey
              const program = programById.get(String(session.program_id))

              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <div
                    className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-center ${
                      isToday
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase leading-none">{getDayLabel(date)}</span>
                    <span className="text-sm font-bold leading-tight">{date.getDate()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{session.program_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isToday ? 'Aujourd\'hui' : formatShortDate(date)} • {program?.difficulty || 'Programme'}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedSession)} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="sm:max-w-2xl rounded-3xl border-none p-0 shadow-xl overflow-hidden">
          {selectedSession && (
            <>
              <DialogHeader className="px-6 pt-6">
                <DialogTitle className="text-xl font-bold text-slate-900">{selectedSession.program_name}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Prévu le {formatLongDate(dateFromKey(selectedSession.scheduled_date))}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-6 py-4">
                {selectedProgram?.description && (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {selectedProgram.description}
                  </p>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">Contenu du programme</p>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                      {selectedExercises.length} exercices
                    </Badge>
                  </div>

                  {selectedExercises.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Le contenu détaillé n'est pas disponible pour ce programme.
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {selectedExercises.map((exercise, index) => (
                        <div
                          key={exercise.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {index + 1}. {exercise.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {exercise.sets || '—'} séries • {exercise.reps || '—'} reps
                            {exercise.rest_time ? ` • repos ${exercise.rest_time}` : ''}
                            {exercise.body_part ? ` • ${exercise.body_part}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                <Button variant="ghost" onClick={closeDetails}>Fermer</Button>
                <Button
                  onClick={() => navigate(`/client/workout/${selectedSession.program_id}`)}
                  className="gap-2 bg-primary font-semibold text-white hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Lancer la séance
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CoachBanner({ nextSession }: { nextSession: ScheduledSession | null }) {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-r from-primary/90 to-emerald-500 text-white shadow-lg shadow-primary/20">
      <CardContent className="flex items-center justify-between p-4 lg:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {nextSession ? 'Prochaine séance planifiée' : 'Aucune séance planifiée'}
            </p>
            <p className="text-xs text-white/80">
              {nextSession
                ? `${nextSession.program_name} • ${formatShortDate(dateFromKey(nextSession.scheduled_date))}`
                : 'Ton coach peut planifier tes prochaines sessions depuis ton calendrier.'}
            </p>
          </div>
        </div>
        {nextSession ? (
          <Button
            size="sm"
            onClick={() => navigate(`/client/workout/${nextSession.program_id}`)}
            className="h-10 bg-white text-primary font-bold shadow-sm hover:bg-white/90 gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Lancer
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => navigate('/client/coach')}
            className="h-10 bg-white text-primary font-bold shadow-sm hover:bg-white/90 gap-1.5"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Demander
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function CoachTip({
  thisWeekWorkouts,
  thisWeekScheduledWorkouts,
}: {
  thisWeekWorkouts: number
  thisWeekScheduledWorkouts: number
}) {
  const completionRatio =
    thisWeekScheduledWorkouts > 0 ? Math.round((thisWeekWorkouts / thisWeekScheduledWorkouts) * 100) : null

  const adviceText = completionRatio === null
    ? 'Ton coach n’a pas encore planifié de séance cette semaine.'
    : completionRatio >= 100
      ? 'Excellent rythme cette semaine. Continue sur cette dynamique !'
      : completionRatio >= 60
        ? 'Très bon progrès. Garde la régularité sur tes prochaines séances.'
        : 'Essaie de valider ta prochaine séance prévue pour relancer la dynamique.'

  return (
    <Card className="border-primary/15 bg-primary/5 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Le conseil du Coach</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/80">
              {adviceText}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentActivity({ logs }: { logs: WorkoutLog[] }) {
  const navigate = useNavigate()
  if (logs.length === 0) return null

  return (
    <Card className="border-border/40 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Activité récente
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-4 max-h-[360px] overflow-y-auto custom-scrollbar">
        {logs.length === 0 ? (
          <p className="rounded-xl bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
            Pas encore d'activité enregistrée.
          </p>
        ) : (
          logs.map((log) => {
            const date = new Date(log.completed_at)
            const timeAgo = getTimeAgo(date)
            const canRelaunch = !!log.program_id

            return (
              <button
                key={log.id}
                type="button"
                onClick={() => canRelaunch && navigate(`/client/workout/${log.program_id}`)}
                disabled={!canRelaunch}
                className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-primary/5 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Dumbbell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {log.programs?.name || 'Séance'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
                </div>
                {log.duration_minutes ? (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {log.duration_minutes} min
                  </span>
                ) : null}
                {canRelaunch && (
                  <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// Skeleton Loader
// ──────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Skeleton className="h-7 w-72" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getDayLabel(date: Date): string {
  const labels = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
  return labels[date.getDay()]
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `${diffMin} min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Hier'
  return `${diffDays}j`
}

function getWeekRange(reference: Date): { start: Date; end: Date } {
  const start = new Date(reference)
  const day = start.getDay()
  const mondayShift = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + mondayShift)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

