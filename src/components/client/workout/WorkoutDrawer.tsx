import { useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  CheckCircle2,
  Layers,
  Repeat2,
  Repeat,
  Timer,
  StopCircle,
} from 'lucide-react'
import { ExerciseImage } from '@/components/ui/exercise-image'
import type { WorkoutExercise } from '@/hooks/useActiveWorkout'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const normalizeExecutionMode = (
  mode?: string | null
): 'Superset' | 'Circuit' | 'AMRAP' | 'EMOM' | 'Tabata' => {
  const n = String(mode || '').trim().toLowerCase()
  if (n.includes('amrap')) return 'AMRAP'
  if (n.includes('emom')) return 'EMOM'
  if (n.includes('tabata')) return 'Tabata'
  if (n.includes('circuit')) return 'Circuit'
  return 'Superset'
}

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

const toDisplayText = (value?: string | number | null): string | null => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

const getEffortShort = (exercise: WorkoutExercise): string => {
  const t = normalizeText(exercise.effort_type)
  if (t === 'max_reps' || t.includes('max rep')) return 'Max rép'
  if (t === 'max_time' || t.includes('max temps')) return 'Max temps'
  if (t === 'intensity' && exercise.intensity) return String(exercise.intensity)
  if (t === 'distance' && exercise.reps) return String(exercise.reps)
  if (exercise.reps_min && exercise.reps_max) return `${exercise.reps_min}–${exercise.reps_max}`
  if (exercise.reps) return String(exercise.reps)
  if (exercise.duration_minutes) return String(exercise.duration_minutes)
  return '—'
}

const getGroupMeta = (mode: ReturnType<typeof normalizeExecutionMode>, count: number) => {
  const tabata = mode === 'Tabata'
  const amrap = mode === 'AMRAP'
  const emom = mode === 'EMOM'

  if (tabata || amrap) return { label: mode, Icon: Timer, color: 'bg-rose-100 text-rose-700' }
  if (emom) return { label: 'EMOM', Icon: Timer, color: 'bg-violet-100 text-violet-700' }
  if (mode === 'Circuit' || count >= 4) return { label: 'Circuit', Icon: Repeat, color: 'bg-amber-100 text-amber-800' }
  if (count === 3) return { label: 'Triset', Icon: Repeat2, color: 'bg-amber-100 text-amber-800' }
  return { label: 'Superset', Icon: Layers, color: 'bg-amber-100 text-amber-800' }
}

const sectionTone = (name: string) => {
  const n = normalizeText(name)
  if (n.includes('echauff') || n.includes('warm')) return 'text-orange-600'
  if (n.includes('etirement') || n.includes('stretch') || n.includes('retour') || n.includes('cool'))
    return 'text-sky-600'
  if (n.includes('mobilit')) return 'text-indigo-600'
  return 'text-emerald-600'
}

/* -------------------------------------------------------------------------- */
/*  Drawer entries — sections + grouped/single exercises                      */
/* -------------------------------------------------------------------------- */

interface ExerciseWithIndex {
  exercise: WorkoutExercise
  index: number
}

type DrawerEntry =
  | { kind: 'section'; id: string; name: string }
  | { kind: 'single'; item: ExerciseWithIndex }
  | {
      kind: 'group'
      groupId: string
      mode: ReturnType<typeof normalizeExecutionMode>
      items: ExerciseWithIndex[]
    }

const buildDrawerEntries = (exercises: WorkoutExercise[]): DrawerEntry[] => {
  // Preserve original index for navigation
  const ordered = exercises
    .map((ex, idx) => ({ ex, idx }))
    .sort((a, b) => (a.ex.order || 0) - (b.ex.order || 0))

  const entries: DrawerEntry[] = []
  const seen = new Set<string>()

  for (let i = 0; i < ordered.length; i++) {
    const { ex, idx } = ordered[i]

    if (ex.is_section_header) {
      entries.push({
        kind: 'section',
        id: `section-${ex.id || i}`,
        name: ex.name || 'Section',
      })
      continue
    }

    const supersetId = ex.superset_id ? String(ex.superset_id) : null

    if (!supersetId) {
      entries.push({
        kind: 'single',
        item: { exercise: ex, index: idx },
      })
      continue
    }

    if (seen.has(supersetId)) continue
    seen.add(supersetId)

    const groupItems: ExerciseWithIndex[] = ordered
      .filter((o) => String(o.ex.superset_id || '') === supersetId)
      .map((o) => ({ exercise: o.ex, index: o.idx }))

    if (groupItems.length <= 1) {
      entries.push({
        kind: 'single',
        item: { exercise: ex, index: idx },
      })
      continue
    }

    entries.push({
      kind: 'group',
      groupId: supersetId,
      mode: normalizeExecutionMode(groupItems[0].exercise.execution_mode || groupItems[0].exercise.type),
      items: groupItems,
    })
  }

  return entries
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

interface WorkoutDrawerProps {
  isOpen: boolean
  onClose: () => void
  workout: {
    name: string
    exercises: WorkoutExercise[]
  }
  currentExerciseIndex: number
  onSelectExercise: (index: number) => void
  onStopWorkout: () => void
}

export function WorkoutDrawer({
  isOpen,
  onClose,
  workout,
  currentExerciseIndex,
  onSelectExercise,
  onStopWorkout,
}: WorkoutDrawerProps) {
  const realExercises = useMemo(
    () => workout.exercises.filter((ex) => !ex.is_section_header),
    [workout.exercises]
  )

  const totalExercises = realExercises.length
  const currentRealIndex = useMemo(() => {
    // Translate `currentExerciseIndex` (which counts headers) to the index within real exercises
    const target = workout.exercises[currentExerciseIndex]
    if (!target) return 0
    const targetId = String(target.id)
    const idx = realExercises.findIndex((e) => String(e.id) === targetId)
    return Math.max(0, idx)
  }, [workout.exercises, currentExerciseIndex, realExercises])

  const progressPercent = totalExercises > 0
    ? Math.min(100, Math.round((currentRealIndex / totalExercises) * 100))
    : 0

  const entries = useMemo(() => buildDrawerEntries(workout.exercises), [workout.exercises])

  const goTo = (index: number) => {
    onSelectExercise(index)
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-slate-50 border-none gap-0"
      >
        {/* Header */}
        <header className="px-5 pt-6 pb-5 bg-white border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-lg font-black text-slate-900 truncate">
              {workout.name}
            </SheetTitle>
            <SheetDescription className="mt-0.5 text-xs font-medium text-slate-500">
              Exercice {Math.min(currentRealIndex + 1, totalExercises)} sur {totalExercises}
            </SheetDescription>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {entries.map((entry) => {
            if (entry.kind === 'section') {
              return (
                <div key={entry.id} className="flex items-center gap-2 pt-2 px-1">
                  <span className={`h-2 w-2 rounded-full bg-current ${sectionTone(entry.name)}`} />
                  <span className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${sectionTone(entry.name)}`}>
                    {entry.name}
                  </span>
                  <div className="ml-2 h-px flex-1 bg-slate-200/70" />
                </div>
              )
            }

            if (entry.kind === 'single') {
              const exo = entry.item.exercise
              const idx = entry.item.index
              const isCurrent = idx === currentExerciseIndex
              const isPast = idx < currentExerciseIndex

              return (
                <SingleRow
                  key={String(exo.id)}
                  exercise={exo}
                  isCurrent={isCurrent}
                  isPast={isPast}
                  onClick={() => goTo(idx)}
                />
              )
            }

            const { Icon, label, color } = getGroupMeta(entry.mode, entry.items.length)
            const hasCurrent = entry.items.some((it) => it.index === currentExerciseIndex)
            const allPast = entry.items.every((it) => it.index < currentExerciseIndex)

            return (
              <article
                key={`group-${entry.groupId}`}
                className={`rounded-2xl ring-1 overflow-hidden transition-shadow ${
                  hasCurrent
                    ? 'bg-amber-50/40 ring-amber-200 shadow-sm'
                    : allPast
                      ? 'bg-white ring-slate-100'
                      : 'bg-white ring-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/60">
                  <div className="flex items-center gap-2">
                    <Badge className={`${color} border-none rounded-md text-[10px] font-extrabold uppercase tracking-wider gap-1`}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </Badge>
                    <span className="text-[11px] font-medium text-slate-500">
                      {entry.items.length} exos
                    </span>
                  </div>
                  {allPast && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>

                <div className="px-2 pb-2 pt-1 space-y-1.5">
                  {entry.items.map(({ exercise, index }, innerIdx) => {
                    const isCurrent = index === currentExerciseIndex
                    const isPast = index < currentExerciseIndex
                    return (
                      <SingleRow
                        key={String(exercise.id)}
                        exercise={exercise}
                        isCurrent={isCurrent}
                        isPast={isPast}
                        compact
                        prefix={`${innerIdx + 1}.`}
                        onClick={() => goTo(index)}
                      />
                    )
                  })}
                </div>
              </article>
            )
          })}

          {totalExercises === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-medium text-slate-500">
              Aucun exercice dans cette séance.
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 bg-white border-t border-slate-100">
          <Button
            variant="ghost"
            className="w-full h-12 rounded-2xl gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold"
            onClick={() => {
              onClose()
              onStopWorkout()
            }}
          >
            <StopCircle className="h-4 w-4" />
            Arrêter la séance
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

/* -------------------------------------------------------------------------- */
/*  Single exercise row                                                        */
/* -------------------------------------------------------------------------- */

interface SingleRowProps {
  exercise: WorkoutExercise
  isCurrent: boolean
  isPast: boolean
  onClick: () => void
  compact?: boolean
  prefix?: string
}

function formatCharge(exercise: WorkoutExercise): string | null {
  const chargeType = String(exercise.charge_type || '').trim()
  const charge = toDisplayText(exercise.charge)
  const lowered = chargeType.toLowerCase()
  if (lowered === 'pdc') return 'PDC'
  if (lowered === 'none') return null
  if (charge) {
    const cl = charge.toLowerCase()
    const alreadyHasUnit = chargeType
      ? cl.includes(lowered) || /\b(kg|lbs|lb)\b/.test(cl)
      : true
    return alreadyHasUnit ? charge : `${charge} ${chargeType}`
  }
  if (!chargeType || lowered === 'kg' || lowered === 'lbs' || lowered === 'lb') return null
  return chargeType
}

function SingleRow({ exercise, isCurrent, isPast, onClick, compact = false, prefix }: SingleRowProps) {
  const chargeLabel = formatCharge(exercise)

  const sets = toDisplayText(exercise.sets)
  const effort = getEffortShort(exercise)
  const rest = toDisplayText(exercise.rest_time)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-all ${
        isCurrent
          ? 'bg-emerald-50 ring-2 ring-emerald-400 shadow-sm'
          : compact
            ? 'bg-white hover:bg-slate-50 ring-1 ring-slate-100'
            : 'bg-white hover:bg-slate-50 ring-1 ring-slate-200'
      } ${isPast && !isCurrent ? 'opacity-60' : ''}`}
    >
      {/* Photo */}
      <div className={`relative shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 ${compact ? 'h-12 w-12' : 'h-14 w-14'}`}>
        <ExerciseImage
          src={exercise.photo_url}
          alt={exercise.name}
          className="h-full w-full object-cover"
          fallbackClassName="h-full w-full bg-slate-100 flex items-center justify-center"
        />
        {isPast && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
            <CheckCircle2 className="h-5 w-5 text-white drop-shadow" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={`truncate text-sm font-bold ${
              isCurrent ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {prefix && <span className="text-slate-400 font-semibold mr-1">{prefix}</span>}
            {exercise.name}
          </p>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
              Actif
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
          {sets ? `${sets}× · ` : ''}
          <span className="text-slate-700 font-bold">{effort}</span>
          {chargeLabel && <> · {chargeLabel}</>}
          {rest && <> · repos {rest}</>}
        </p>
      </div>
    </button>
  )
}
