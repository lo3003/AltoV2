import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  Clock3,
  Dumbbell,
  Flame,
  Home,
  Layers,
  ListChecks,
  Lock,
  MessageCircle,
  Play,
  Repeat,
  Repeat2,
  Timer,
  UserCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ExerciseImage } from '@/components/ui/exercise-image'
import { useWorkoutPreview } from '@/hooks/useWorkoutPreview'
import { useClientProfile } from '@/hooks/useClientProfile'
import { useClientCalendar } from '@/hooks/useClientCalendar'
import type { WorkoutExercise } from '@/hooks/useActiveWorkout'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
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

const formatLongDate = (key: string) => {
  const date = dateFromKey(key)
  if (Number.isNaN(date.getTime())) return key
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const daysBetween = (fromKey: string, toKey: string) => {
  const a = dateFromKey(fromKey)
  const b = dateFromKey(toKey)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

const toSetsCount = (value?: string | number | null) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric)
  return 1
}

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

const toDisplayText = (value?: string | number | null) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

// Normalise une durée saisie de façon hétérogène ("15", "15m", "5 min", "30s")
// en libellé lisible. Un nombre seul est interprété comme des minutes.
const formatDuration = (raw?: string | number | null): string => {
  if (raw === null || raw === undefined) return ''
  const text = String(raw).trim()
  if (!text) return ''
  // Déjà une unité explicite (min, m, s, ', ") → on garde, en normalisant "m" -> "min"
  if (/[a-zA-Z'"]/.test(text)) {
    return text.replace(/(\d)\s*m$/i, '$1 min')
  }
  // Nombre nu → minutes
  return `${text} min`
}

const getEffortDisplay = (exercise: WorkoutExercise): { label: string; value: string } => {
  const effortType = normalizeText(exercise.effort_type)

  if (effortType === 'max_reps' || effortType.includes('max rep')) {
    return { label: 'Effort', value: 'Max rép' }
  }
  if (effortType === 'max_time' || effortType.includes('max temps') || effortType.includes('max time')) {
    return {
      label: 'Effort',
      value: exercise.duration_minutes ? `Max · ${formatDuration(exercise.duration_minutes)}` : 'Max temps',
    }
  }
  if (effortType === 'intensity' && exercise.intensity) {
    return { label: 'Intensité', value: String(exercise.intensity) }
  }
  if (effortType === 'distance' && exercise.reps) {
    return { label: 'Distance', value: String(exercise.reps) }
  }
  if (exercise.reps_min && exercise.reps_max) {
    return { label: 'Reps', value: `${exercise.reps_min}–${exercise.reps_max}` }
  }
  if (exercise.reps) {
    return { label: 'Reps', value: String(exercise.reps) }
  }
  if (exercise.duration_minutes) {
    return { label: 'Durée', value: formatDuration(exercise.duration_minutes) }
  }
  return { label: 'Reps', value: '—' }
}

const formatCharge = (exercise: WorkoutExercise): string | null => {
  const chargeType = String(exercise.charge_type || '').trim()
  const charge = toDisplayText(exercise.charge)
  const lowered = chargeType.toLowerCase()

  if (lowered === 'pdc') return 'PDC'
  if (lowered === 'none') return null

  if (charge) {
    // Don't double-print the unit if user already typed it ("60 kg" + type "kg")
    const chargeLower = charge.toLowerCase()
    const alreadyHasUnit = chargeType
      ? chargeLower.includes(lowered) || /\b(kg|lbs|lb)\b/.test(chargeLower)
      : true
    return alreadyHasUnit ? charge : `${charge} ${chargeType}`
  }

  // No charge value: only return the type if it's meaningful
  if (!chargeType || lowered === 'kg' || lowered === 'lbs' || lowered === 'lb') return null
  return chargeType
}

const getGroupMode = (exercise: WorkoutExercise, count: number): {
  label: string
  short: string
  icon: typeof Layers
  color: string
} => {
  const normalized = normalizeText(exercise.execution_mode || exercise.type)
  if (normalized.includes('amrap')) return { label: 'AMRAP', short: 'AMRAP', icon: Timer, color: 'rose' }
  if (normalized.includes('emom')) return { label: 'EMOM', short: 'EMOM', icon: Timer, color: 'violet' }
  if (normalized.includes('tabata')) return { label: 'Tabata', short: 'Tabata', icon: Timer, color: 'rose' }
  if (normalized.includes('circuit')) return { label: 'Circuit', short: 'Circuit', icon: Repeat, color: 'amber' }
  if (count >= 4) return { label: 'Circuit', short: 'Circuit', icon: Repeat, color: 'amber' }
  if (count === 3) return { label: 'Triset', short: 'Triset', icon: Repeat2, color: 'amber' }
  return { label: 'Superset', short: 'Superset', icon: Layers, color: 'amber' }
}

/* -------------------------------------------------------------------------- */
/*  Section + Block model                                                      */
/*    A "block" is either a single exercise or a group (superset/circuit/...)  */
/* -------------------------------------------------------------------------- */

interface ExerciseBlock {
  id: string
  type: 'single' | 'group'
  exercises: WorkoutExercise[]
  rounds: number
  groupMode?: ReturnType<typeof getGroupMode>
}

interface ExerciseSection {
  id: string
  name: string
  blocks: ExerciseBlock[]
}

const buildSections = (items: WorkoutExercise[]): ExerciseSection[] => {
  const ordered = [...items].sort((left, right) => (left.order || 0) - (right.order || 0))
  const sections: ExerciseSection[] = []
  let current: ExerciseSection = {
    id: 'section-default',
    name: 'Corps de séance',
    blocks: [],
  }

  // First pass: group by superset_id
  const supersetSeen = new Set<string>()

  ordered.forEach((item, index) => {
    if (item.is_section_header) {
      if (current.blocks.length > 0) sections.push(current)
      current = {
        id: `section-${item.id || index}`,
        name: item.name || 'Section',
        blocks: [],
      }
      return
    }

    const supersetId = item.superset_id ? String(item.superset_id) : null
    if (supersetId) {
      if (supersetSeen.has(supersetId)) return
      supersetSeen.add(supersetId)

      const groupItems = ordered.filter(
        (it) => !it.is_section_header && String(it.superset_id || '') === supersetId
      )
      if (groupItems.length === 0) return

      if (groupItems.length === 1) {
        current.blocks.push({
          id: `single-${groupItems[0].id}`,
          type: 'single',
          exercises: groupItems,
          rounds: toSetsCount(groupItems[0].sets),
        })
      } else {
        const rounds = groupItems.reduce(
          (max, it) => Math.max(max, toSetsCount(it.sets)),
          1
        )
        current.blocks.push({
          id: `group-${supersetId}`,
          type: 'group',
          exercises: groupItems,
          rounds,
          groupMode: getGroupMode(groupItems[0], groupItems.length),
        })
      }
      return
    }

    current.blocks.push({
      id: `single-${item.id}`,
      type: 'single',
      exercises: [item],
      rounds: toSetsCount(item.sets),
    })
  })

  if (current.blocks.length > 0) sections.push(current)
  return sections
}

const sectionTone = (name: string) => {
  const n = normalizeText(name)
  if (n.includes('echauff') || n.includes('warm')) {
    return { dot: 'bg-orange-500', text: 'text-orange-700', label: 'Échauffement' }
  }
  if (n.includes('etirement') || n.includes('stretch')) {
    return { dot: 'bg-sky-500', text: 'text-sky-700', label: 'Étirement' }
  }
  if (n.includes('retour') || n.includes('cool') || n.includes('cooldown')) {
    return { dot: 'bg-sky-500', text: 'text-sky-700', label: 'Retour au calme' }
  }
  if (n.includes('mobilit')) {
    return { dot: 'bg-indigo-500', text: 'text-indigo-700', label: 'Mobilité' }
  }
  return { dot: 'bg-emerald-500', text: 'text-emerald-700', label: name }
}

const groupColorClasses = (color: string) => {
  switch (color) {
    case 'rose':
      return {
        ring: 'ring-rose-200',
        bg: 'bg-rose-50/50',
        chip: 'bg-rose-100 text-rose-700',
        accent: 'bg-rose-500',
      }
    case 'violet':
      return {
        ring: 'ring-violet-200',
        bg: 'bg-violet-50/50',
        chip: 'bg-violet-100 text-violet-700',
        accent: 'bg-violet-500',
      }
    case 'amber':
    default:
      return {
        ring: 'ring-amber-200',
        bg: 'bg-amber-50/40',
        chip: 'bg-amber-100 text-amber-800',
        accent: 'bg-amber-500',
      }
  }
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function WorkoutPreview() {
  const navigate = useNavigate()
  const { programId } = useParams<{ programId: string }>()
  const { program, exercises, loading, error, accessDenied, accessDeniedReason, alwaysAccessible } = useWorkoutPreview(programId)
  const { client } = useClientProfile()
  const { sessions: scheduledSessions } = useClientCalendar(client?.id)

  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string; comment?: string | null } | null>(null)

  const sections = useMemo(() => buildSections(exercises), [exercises])
  const totalExercises = useMemo(
    () => exercises.filter((ex) => !ex.is_section_header).length,
    [exercises]
  )

  const coachInstructions = useMemo(
    () => String(program?.coach_instructions || '').trim(),
    [program?.coach_instructions]
  )

  const sessionInstructions = useMemo(() => {
    const sess = String(program?.session_instructions || '').trim()
    const desc = String(program?.description || '').trim()
    if (sess && desc && sess !== desc) return `${sess}\n\n${desc}`
    return sess || desc || ''
  }, [program?.description, program?.session_instructions])

  const estimatedDuration = useMemo(() => {
    if (!program?.estimated_duration_minutes || program.estimated_duration_minutes <= 0) return null
    return `${program.estimated_duration_minutes} min`
  }, [program?.estimated_duration_minutes])

  const environment = useMemo(() => {
    const env = String((program as any)?.environment || '').trim()
    if (!env) return null
    return env
  }, [program])

  /**
   * Determine if the client can launch the workout right now.
   *
   * Rule: if there is at least one scheduled_session for this program-client pair,
   * the launch is locked to the day equal to `scheduled_date`. The ±3 days
   * flexibility is already absorbed in `scheduled_date` (the client moves it via
   * the planning page). If no schedule exists, free launch is allowed (legacy).
   */
  const launchEligibility = useMemo(() => {
    const todayKey = toDateKey(new Date())

    // No client identified or no programId — fallback to free launch
    if (!client?.id || !programId) {
      return { kind: 'free' as const }
    }

    // Programme épinglé "toujours accessible" → lancement libre, on ignore
    // les séances planifiées (c'est une routine sans contrainte de date).
    if (alwaysAccessible) {
      return { kind: 'free' as const }
    }

    const programSessions = scheduledSessions
      .filter(
        (s) =>
          String(s.program_id) === String(programId) &&
          String(s.status).toLowerCase() === 'planned'
      )
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

    // No schedule exists for this program → free preview/launch (existing behavior)
    if (programSessions.length === 0) {
      return { kind: 'free' as const }
    }

    // Today exactly matches a planned session → unlock
    const todaySession = programSessions.find((s) => s.scheduled_date === todayKey)
    if (todaySession) {
      return { kind: 'today' as const, session: todaySession }
    }

    // Find the next upcoming session
    const upcoming = programSessions.find((s) => s.scheduled_date > todayKey)
    if (upcoming) {
      const days = daysBetween(todayKey, upcoming.scheduled_date)
      return {
        kind: 'future' as const,
        session: upcoming,
        daysUntil: days,
      }
    }

    // All planned sessions are in the past
    const lastPast = programSessions[programSessions.length - 1]
    return { kind: 'past' as const, session: lastPast }
  }, [client?.id, programId, scheduledSessions, alwaysAccessible])

  const canLaunch = launchEligibility.kind === 'free' || launchEligibility.kind === 'today'

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 px-4 py-12 text-center text-sm font-medium text-slate-500">
        Chargement de la séance…
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 px-4 py-12 text-center text-sm font-medium text-rose-600">
        {error || 'Séance introuvable.'}
      </div>
    )
  }

  // Accès refusé : programme déjà réalisé ou date de disponibilité dépassée.
  if (accessDenied) {
    const reasonText =
      accessDeniedReason === 'completed'
        ? 'Tu as déjà réalisé ce programme. Son détail n\'est plus consultable.'
        : accessDeniedReason === 'expired'
          ? 'La période de disponibilité de ce programme est terminée.'
          : "Ce programme n'est plus disponible dans ton espace."
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
          <Lock className="h-7 w-7 text-slate-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">{program.name}</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">{reasonText}</p>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Le nom reste visible dans ton historique pour tes statistiques.
        </p>
        <Button
          onClick={() => navigate('/client/dashboard')}
          className="mt-5 h-11 rounded-xl bg-[#10b981] font-bold text-white hover:bg-[#059669]"
        >
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-32">
      {/* Top bar — minimal, transparent overlay */}
      <div className="fixed left-0 right-0 top-0 z-40 px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/client/dashboard')}
            className="h-10 w-10 rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm backdrop-blur">
            Aperçu
          </span>
          <div className="w-10" />
        </div>
      </div>

      {/* HERO */}
      <header className="relative h-[260px] sm:h-[300px] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-500 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-emerald-400/40 blur-3xl" />
        </div>

        {/* Big icon watermark */}
        <Dumbbell className="pointer-events-none absolute right-6 top-1/2 h-44 w-44 -translate-y-1/2 text-white/5" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col justify-end px-5 pb-6 pt-20">
          <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
            <Flame className="h-3 w-3" />
            Programme
          </span>
          <h1 className="text-3xl font-black leading-[1.1] text-white sm:text-4xl">
            {program.name}
          </h1>

          {/* Stats chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <HeroChip
              icon={ListChecks}
              label={`${totalExercises} ${totalExercises > 1 ? 'exercices' : 'exercice'}`}
            />
            {estimatedDuration && <HeroChip icon={Clock3} label={estimatedDuration} />}
            {environment && (
              <HeroChip
                icon={environment.toLowerCase().includes('home') || environment.toLowerCase().includes('domicile') ? Home : Dumbbell}
                label={environment}
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        {/* Coach instructions — strong CTA */}
        {coachInstructions && (
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200/70">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                  Consigne de ton coach
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                  {coachInstructions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Session instructions — calmer */}
        {sessionInstructions && (
          <details className="group rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <p className="text-sm font-bold text-slate-900">Instructions de séance</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-open:hidden">
                Lire
              </span>
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 group-open:inline">
                Réduire
              </span>
            </summary>
            <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {sessionInstructions}
            </p>
          </details>
        )}

        {/* Sections */}
        <div className="space-y-7">
          {sections.map((section) => {
            const tone = sectionTone(section.name)
            const exoCount = section.blocks.reduce((sum, b) => sum + b.exercises.length, 0)

            return (
              <section key={section.id} className="space-y-3">
                {/* Slim section divider — no big card around */}
                <div className="flex items-center gap-3 px-1">
                  <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                  <h2 className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${tone.text}`}>
                    {section.name}
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {exoCount} {exoCount > 1 ? 'exos' : 'exo'}
                  </span>
                  <div className="ml-auto h-px flex-1 bg-slate-200/70" />
                </div>

                {/* Blocks */}
                <div className="space-y-3">
                  {section.blocks.map((block) =>
                    block.type === 'single' ? (
                      <SoloExerciseRow
                        key={block.id}
                        exercise={block.exercises[0]}
                        rounds={block.rounds}
                        onZoom={(src, alt, comment) =>
                          setZoomImage({ src, alt, comment })
                        }
                      />
                    ) : (
                      <GroupBlockCard
                        key={block.id}
                        block={block}
                        onZoom={(src, alt, comment) =>
                          setZoomImage({ src, alt, comment })
                        }
                      />
                    )
                  )}
                </div>
              </section>
            )
          })}
        </div>

        {totalExercises === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">
            Aucun exercice n'a encore été ajouté à ce programme.
          </div>
        )}
      </main>

      {/* Sticky CTA */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
        <div className="h-24 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent" />
        <div className="pointer-events-auto -mt-16 px-4 pb-4 safe-bottom">
          <div className="mx-auto w-full max-w-3xl space-y-2">
            {/* Lock notice */}
            {!canLaunch && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${
                  launchEligibility.kind === 'future'
                    ? 'bg-sky-50 text-sky-800 ring-sky-200'
                    : 'bg-amber-50 text-amber-800 ring-amber-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {launchEligibility.kind === 'future' ? (
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="flex-1">
                    {launchEligibility.kind === 'future' && (
                      <>
                        <p className="font-bold">
                          Disponible {launchEligibility.daysUntil === 1
                            ? 'demain'
                            : `dans ${launchEligibility.daysUntil} jours`}
                        </p>
                        <p className="mt-0.5 text-[12px]">
                          Séance prévue le {formatLongDate(launchEligibility.session.scheduled_date)}.
                          Tu peux l'avancer ±3 jours via ton planning.
                        </p>
                      </>
                    )}
                    {launchEligibility.kind === 'past' && (
                      <>
                        <p className="font-bold">Cette séance était prévue le {formatLongDate(launchEligibility.session.scheduled_date)}</p>
                        <p className="mt-0.5 text-[12px]">
                          Déplace-la dans ton planning pour la lancer à une nouvelle date.
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/client/planning')}
                    className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider hover:bg-white"
                  >
                    Planning
                  </button>
                </div>
              </div>
            )}

            <Button
              onClick={() => navigate(`/client/workout/${encodeURIComponent(program.id)}/active`)}
              disabled={!canLaunch || totalExercises === 0}
              className="h-14 w-full gap-2 rounded-2xl bg-emerald-500 text-base font-extrabold text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-100 disabled:shadow-none"
            >
              {canLaunch ? (
                <>
                  <Play className="h-5 w-5 fill-white" />
                  Démarrer la séance
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Séance verrouillée
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Zoom dialog */}
      <Dialog open={Boolean(zoomImage)} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="h-[100dvh] max-w-none overflow-hidden border-none bg-black/95 p-0 sm:h-auto sm:max-w-3xl sm:rounded-3xl">
          <DialogTitle className="sr-only">{zoomImage?.alt || 'Aperçu exercice'}</DialogTitle>
          {zoomImage && (
            <div className="flex h-full w-full flex-col">
              <ExerciseImage
                src={zoomImage.src}
                alt={zoomImage.alt}
                className="h-full max-h-[75vh] w-full object-contain"
                fallbackClassName="h-full min-h-[300px] w-full flex items-center justify-center bg-slate-800"
                iconClassName="h-16 w-16 text-white/40"
              />
              <div className="bg-black/80 px-5 py-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                  {zoomImage.alt}
                </p>
                {zoomImage.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-white/90 whitespace-pre-line">
                    {zoomImage.comment}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function HeroChip({
  icon: Icon,
  label,
}: {
  icon: typeof Layers
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur ring-1 ring-white/20">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex flex-col rounded-lg px-2.5 py-1.5 text-left ${
        highlight ? 'bg-emerald-50' : 'bg-slate-50'
      }`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span
        className={`text-sm font-extrabold tabular-nums ${
          highlight ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

interface ExerciseRowProps {
  exercise: WorkoutExercise
  rounds: number
  onZoom: (src: string, alt: string, comment?: string | null) => void
  compact?: boolean
  /** Quand l'exercice est dans un groupe, séries/repos sont affichés au niveau du groupe. */
  inGroup?: boolean
}

function SoloExerciseRow({ exercise, rounds, onZoom, compact = false, inGroup = false }: ExerciseRowProps) {
  const effort = getEffortDisplay(exercise)
  const charge = formatCharge(exercise)
  const rest = toDisplayText(exercise.rest_time)
  const comment = toDisplayText(exercise.comment)
  const effortDetail = toDisplayText((exercise as any).effort_detail)
  const variants = Array.isArray((exercise as any).variants) ? (exercise as any).variants : []
  const [variantsOpen, setVariantsOpen] = useState(false)
  const isCardio = String(exercise.type || '').toLowerCase() === 'cardio'
  const duration = exercise.duration_minutes ? formatDuration(exercise.duration_minutes) : null
  const intensity = toDisplayText(exercise.intensity)

  return (
    <article
      className={`rounded-2xl bg-white p-3 ring-1 ring-slate-200/70 transition-shadow hover:shadow-sm ${
        compact ? 'sm:p-3' : 'sm:p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Photo */}
        <button
          type="button"
          onClick={() => {
            if (exercise.photo_url) onZoom(exercise.photo_url, exercise.name, exercise.comment)
          }}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/70 sm:h-20 sm:w-20"
        >
          <ExerciseImage
            src={exercise.photo_url}
            alt={exercise.name}
            className="h-full w-full object-cover"
            fallbackClassName="flex h-full w-full items-center justify-center bg-slate-100"
          />
        </button>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold leading-tight text-slate-900">
              {exercise.name}
            </h3>
            {comment && (
              <span
                title="Voir le commentaire du coach"
                className="ml-1 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          {exercise.body_part && (
            <p className="mt-0.5 text-xs font-medium text-slate-500">{exercise.body_part}</p>
          )}

          {/* Stats grid */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {isCardio ? (
              <>
                {duration && <StatPill label="Durée" value={duration} highlight />}
                {intensity && <StatPill label="Intensité" value={intensity} />}
                {charge && <StatPill label="Charge" value={charge} />}
                {!inGroup && rest && <StatPill label="Repos" value={rest} />}
              </>
            ) : (
              <>
                {/* En groupe : séries + repos sont affichés dans l'en-tête du groupe */}
                {!inGroup && <StatPill label="Séries" value={`${rounds}`} highlight />}
                <StatPill label={effort.label} value={effort.value} />
                {charge && <StatPill label="Charge" value={charge} />}
                {!inGroup && rest && <StatPill label="Repos" value={rest} />}
              </>
            )}
          </div>

          {/* Effort detail (cardio free text, e.g. "5 min à 8 km/h, IC 4") */}
          {effortDetail && (
            <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium leading-snug text-sky-800 ring-1 ring-sky-100">
              {effortDetail}
            </p>
          )}

          {/* Inline comment text — always visible (in addition to icon badge) */}
          {comment && (
            <p className="mt-2 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-xs leading-snug text-slate-700 ring-1 ring-emerald-100">
              <span className="font-bold text-emerald-700">Note du coach : </span>
              {comment}
            </p>
          )}

          {/* Variantes disponibles — liste dépliable avec image */}
          {variants.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setVariantsOpen((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-200"
              >
                <Repeat2 className="h-3 w-3" />
                {variantsOpen
                  ? 'Masquer les alternatives'
                  : `${variants.length} alternative${variants.length > 1 ? 's' : ''} possible${variants.length > 1 ? 's' : ''}`}
              </button>

              {variantsOpen && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] font-medium text-amber-700">
                    Pas le matériel ? Tu peux faire à la place :
                  </p>
                  {variants.map((v: any) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2.5 rounded-xl bg-amber-50/70 p-2 ring-1 ring-amber-100"
                    >
                      <button
                        type="button"
                        onClick={() => v.photo_url && onZoom(v.photo_url, v.name, v.comment)}
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                      >
                        <ExerciseImage
                          src={v.photo_url}
                          alt={v.name}
                          className="h-full w-full object-cover"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-slate-100"
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{v.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {[
                            v.sets ? `${v.sets} séries` : null,
                            v.reps ? `${v.reps} reps` : null,
                            v.rest_time ? `${v.rest_time} récup` : null,
                          ].filter(Boolean).join(' · ') || v.body_part || 'Alternative'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

interface GroupBlockProps {
  block: ExerciseBlock
  onZoom: (src: string, alt: string, comment?: string | null) => void
}

function GroupBlockCard({ block, onZoom }: GroupBlockProps) {
  const mode = block.groupMode!
  const Icon = mode.icon
  const colors = groupColorClasses(mode.color)

  // Repos commun du groupe : on prend le premier rest_time renseigné parmi les exos.
  const groupRest = (() => {
    for (const ex of block.exercises) {
      const r = toDisplayText(ex.rest_time)
      if (r) return r
    }
    return null
  })()

  return (
    <article className={`overflow-hidden rounded-2xl ring-1 ${colors.ring} ${colors.bg}`}>
      {/* Group header — récap complet : exos · séries · récup */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/60">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.accent} text-white shadow-sm`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
              {mode.label}
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              {block.exercises.length} exercice{block.exercises.length > 1 ? 's' : ''}
              {' · '}{block.rounds} {block.rounds > 1 ? 'séries' : 'série'}
              {groupRest && <span> · {groupRest} récup</span>}
            </p>
          </div>
        </div>
        <Badge className={`${colors.chip} border-none rounded-md text-[10px] font-extrabold uppercase tracking-wider`}>
          ×{block.rounds}
        </Badge>
      </div>

      {/* Members — séries/repos masqués (affichés au niveau du groupe) */}
      <div className="space-y-2 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        {block.exercises.map((exercise, idx) => (
          <div key={String(exercise.id)} className="relative">
            {/* Connector dot for visual continuity (except last) */}
            {idx < block.exercises.length - 1 && (
              <div
                aria-hidden
                className={`absolute left-[34px] top-[68px] hidden h-3 w-px ${colors.accent} sm:block`}
              />
            )}
            <SoloExerciseRow
              exercise={exercise}
              rounds={toSetsCount(exercise.sets)}
              onZoom={onZoom}
              compact
              inGroup
            />
          </div>
        ))}
      </div>
    </article>
  )
}
