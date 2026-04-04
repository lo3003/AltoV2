import { useMemo, useState } from 'react'
import { CalendarClock, CalendarDays, RefreshCcw } from 'lucide-react'
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

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const dayDiff = (from: string, to: string) => {
  const fromDate = dateFromKey(from)
  const toDate = dateFromKey(to)
  const ms = toDate.getTime() - fromDate.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

const formatLongDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const formatShortDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const getShiftLabel = (coachDate: string, currentDate: string) => {
  const diff = dayDiff(coachDate, currentDate)
  if (diff === 0) return 'Date inchangée'
  if (diff > 0) return `+${diff} jour${diff > 1 ? 's' : ''}`
  const abs = Math.abs(diff)
  return `-${abs} jour${abs > 1 ? 's' : ''}`
}

export default function ClientPlanningPage() {
  const { client, loading: profileLoading } = useClientProfile()
  const {
    sessions,
    loading,
    saving,
    tableReady,
    rescheduleSessionByClient,
  } = useClientCalendar(client?.id)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [sessionToEdit, setSessionToEdit] = useState<ScheduledSession | null>(null)
  const [candidateDate, setCandidateDate] = useState<Date | undefined>()

  const selectedDateKey = toDateKey(selectedDate)

  const sessionsByDate = useMemo(() => {
    return sessions.reduce<Record<string, ScheduledSession[]>>((accumulator, session) => {
      if (!accumulator[session.scheduled_date]) {
        accumulator[session.scheduled_date] = []
      }
      accumulator[session.scheduled_date].push(session)
      return accumulator
    }, {})
  }, [sessions])

  const selectedDateSessions = sessionsByDate[selectedDateKey] || []

  const scheduledDays = useMemo(() => {
    return Object.keys(sessionsByDate).map((key) => dateFromKey(key))
  }, [sessionsByDate])

  const shiftedSessionsCount = useMemo(() => {
    return sessions.filter((session) => session.scheduled_date !== session.coach_scheduled_date).length
  }, [sessions])

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
    return <div className="rounded-xl bg-white p-6 text-sm text-slate-500">Chargement du planning...</div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">Planning</h1>
        <p className="text-sm text-muted-foreground">
          Vue globale de toutes tes séances prévues par ton coach.
        </p>
      </div>

      {!tableReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Le planning n&apos;est pas disponible pour le moment (table `scheduled_sessions` absente).
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="border-border/40 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendrier global
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{
                scheduled: scheduledDays,
              }}
              modifiersClassNames={{
                scheduled: 'bg-primary/15 text-primary font-bold',
              }}
              className="rounded-xl border border-slate-100"
            />

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{sessions.length} séance(s) planifiée(s)</p>
              <p className="mt-1">{shiftedSessionsCount} séance(s) déplacée(s) par le client</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/40 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Séances du {selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateSessions.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Aucune séance prévue ce jour.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDateSessions.map((session) => {
                    const isShifted = session.scheduled_date !== session.coach_scheduled_date
                    return (
                      <div
                        key={session.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{session.program_name}</p>
                            <p className="text-xs text-slate-500">Prévue coach: {formatShortDate(session.coach_scheduled_date)}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary border-none capitalize">{session.status}</Badge>
                            {isShifted && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-none">
                                {getShiftLabel(session.coach_scheduled_date, session.scheduled_date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                Toutes les séances
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Ton coach n&apos;a pas encore planifié de séance.
                </p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => {
                    const isShifted = session.scheduled_date !== session.coach_scheduled_date
                    const canReschedule = !['completed', 'cancelled'].includes(String(session.status).toLowerCase())

                    return (
                      <div key={session.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{session.program_name}</p>
                            <p className="text-xs text-slate-500">Date prévue: {formatLongDate(session.coach_scheduled_date)}</p>
                            <p className="text-xs text-slate-600">
                              Date de réalisation: {formatLongDate(session.scheduled_date)}
                            </p>
                            {isShifted && (
                              <p className="mt-1 text-[11px] font-semibold text-amber-700">
                                Déplacement client {getShiftLabel(session.coach_scheduled_date, session.scheduled_date)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary border-none capitalize">{session.status}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRescheduleDialog(session)}
                              disabled={!canReschedule || saving || !tableReady}
                              className="gap-1"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Déplacer
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(sessionToEdit)} onOpenChange={(open) => !open && closeRescheduleDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Déplacer la séance</DialogTitle>
            <DialogDescription>
              Tu peux choisir une date comprise entre -3 et +3 jours autour du planning coach.
            </DialogDescription>
          </DialogHeader>

          {sessionToEdit && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">{sessionToEdit.program_name}</p>
                <p className="mt-1">Date coach: {formatLongDate(sessionToEdit.coach_scheduled_date)}</p>
                <p>
                  Fenêtre autorisée: {formatShortDate(toDateKey(addDays(dateFromKey(sessionToEdit.coach_scheduled_date), -3)))}
                  {' '}→{' '}
                  {formatShortDate(toDateKey(addDays(dateFromKey(sessionToEdit.coach_scheduled_date), 3)))}
                </p>
              </div>

              <Calendar
                mode="single"
                selected={candidateDate}
                onSelect={(date) => {
                  if (date && isDateInAllowedWindow(date)) {
                    setCandidateDate(date)
                  }
                }}
                disabled={(date) => !isDateInAllowedWindow(date)}
                className="rounded-xl border border-slate-100"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeRescheduleDialog}>Annuler</Button>
            <Button onClick={handleConfirmReschedule} disabled={!sessionToEdit || !candidateDate || saving}>
              Confirmer la date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
