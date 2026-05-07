import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Menu,
  MessageSquare,
  X,
  SlidersHorizontal,
  CheckCircle2,
  Layers,
  ZoomIn,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExerciseImage } from '@/components/ui/exercise-image'
import { useActiveWorkout, type WorkoutExercise } from '@/hooks/useActiveWorkout'

// Sub-components
import { WorkoutDrawer } from '@/components/client/workout/WorkoutDrawer'
import { RestTimerView } from '@/components/client/workout/RestTimerView'
import { FeedbackModal } from '@/components/client/workout/FeedbackModal'
import { GroupedExerciseRunner } from '@/components/client/workout/GroupedExerciseRunner'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

const getPrimaryEffortValue = (exercise: WorkoutExercise) => {
  const effortType = normalizeText(exercise.effort_type)

  if (effortType === 'max_reps' || effortType.includes('max rep')) {
    return { label: 'Effort', value: 'Max rép' }
  }
  if (effortType === 'max_time' || effortType.includes('max temps') || effortType.includes('max time')) {
    const target = toDisplayText(exercise.duration_minutes)
    return { label: 'Effort', value: target ? `Max · ${target}` : 'Max temps' }
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
  if (exercise.reps) return { label: 'Reps', value: String(exercise.reps) }
  if (effortType === 'time' || effortType.includes('temps') || effortType.includes('duree') || effortType.includes('duration')) {
    return { label: 'Durée', value: toDisplayText(exercise.duration_minutes) || '—' }
  }
  if (exercise.duration_minutes) {
    return { label: 'Durée', value: String(exercise.duration_minutes) }
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
    const chargeLower = charge.toLowerCase()
    const alreadyHasUnit = chargeType
      ? chargeLower.includes(lowered) || /\b(kg|lbs|lb)\b/.test(chargeLower)
      : true
    return alreadyHasUnit ? charge : `${charge} ${chargeType}`
  }
  if (!chargeType || lowered === 'kg' || lowered === 'lbs' || lowered === 'lb') return null
  return chargeType
}

const getGroupLabel = (mode?: string, count = 1) => {
  const n = normalizeText(mode)
  if (n.includes('amrap')) return 'AMRAP'
  if (n.includes('emom')) return 'EMOM'
  if (n.includes('tabata')) return 'Tabata'
  if (n.includes('circuit') || count >= 4) return 'Circuit'
  if (count === 3) return 'Triset'
  if (count >= 2) return 'Superset'
  return ''
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ActiveWorkout() {
  const navigate = useNavigate()
  const { programId } = useParams<{ programId: string }>()

  const {
    program,
    exercises,
    loading,
    error,
    currentExerciseIndex: currentExoIdx,
    currentExerciseInBlockIndex,
    currentRound,
    blockRoundCount,
    currentBlock,
    executionMode,
    isTimedMode,
    isResting,
    isFinished,
    wasStoppedEarly,
    nextSet,
    finishRest,
    selectExercise,
    completeTimedBlock,
    setTimedExerciseIndex,
    endWorkout,
    sessionStartTime,
    sessionEndTime,
  } = useActiveWorkout(programId)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false)
  const [isMediaZoomOpen, setIsMediaZoomOpen] = useState(false)
  const [showVariants, setShowVariants] = useState(false)
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)

  const currentExo = currentBlock?.exercises[currentExerciseInBlockIndex] || exercises[currentExoIdx]

  const variantCandidates = useMemo(() => {
    if (!currentExo) return []
    const currentId = currentExo.id
    const parentId = currentExo.parent_exercise_id
    return exercises
      .filter((ex) => {
        if (ex.id === currentId) return false
        if (parentId) return ex.id === parentId || ex.parent_exercise_id === parentId
        return ex.parent_exercise_id === currentId
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [exercises, currentExo?.id, currentExo?.parent_exercise_id])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </div>
    )
  }

  if (error || !program || exercises.length === 0 || !currentExo) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="text-red-500">Erreur: {error || 'Programme vide'}</div>
      </div>
    )
  }

  const totalSets = Math.max(1, blockRoundCount)
  const currentSetIdx = Math.max(0, Math.min(currentRound - 1, blockRoundCount - 1))
  const exerciseTotal = exercises.filter((e) => !e.is_section_header).length
  const exerciseCurrent = Math.min(currentExoIdx + 1, exerciseTotal)

  const primaryEffort = getPrimaryEffortValue(currentExo)
  const charge = formatCharge(currentExo)
  const rest = toDisplayText(currentExo.rest_time)

  const isInGroup = currentBlock && currentBlock.exercises.length > 1
  const groupLabel = isInGroup
    ? getGroupLabel(executionMode || currentBlock.mode, currentBlock.exercises.length)
    : ''

  const handleCompleteSet = () => nextSet()
  const handleFinishRest = () => finishRest()
  const requestStopWorkout = () => setIsStopConfirmOpen(true)

  const handleStopWorkout = () => {
    endWorkout(true)
    setIsStopConfirmOpen(false)
    setIsDrawerOpen(false)
  }

  const handleCloseFeedback = () => navigate('/client/dashboard')

  const handleSelectExerciseFromDrawer = (index: number) => {
    selectExercise(index)
    setIsDrawerOpen(false)
  }

  // Next context for the Rest Timer
  const isLastSet = currentRound >= blockRoundCount
  const isLastExo = currentExoIdx === exercises.length - 1
  let nextExoName = currentExo.name
  let nextSetIndicator = `Série ${Math.min(currentRound + 1, blockRoundCount)} sur ${Math.max(1, blockRoundCount)}`
  if (isLastSet && !isLastExo && !isTimedMode) {
    nextExoName = exercises[currentExoIdx + 1].name
    nextSetIndicator = `Série 1 sur ${exercises[currentExoIdx + 1].sets || 1}`
  }

  if (isFinished) {
    const durationMinutes =
      sessionStartTime && sessionEndTime
        ? Math.round((sessionEndTime.getTime() - sessionStartTime.getTime()) / 60000)
        : 0

    return (
      <FeedbackModal
        isOpen={true}
        onClose={handleCloseFeedback}
        programId={program!.id}
        durationMinutes={durationMinutes}
        isStoppedEarly={wasStoppedEarly}
      />
    )
  }

  const cta = isInGroup ? 'Exo suivant' : 'Série terminée'

  return (
    <div className="min-h-[100dvh] bg-slate-50 relative flex flex-col sm:max-w-md sm:mx-auto sm:border-x sm:border-slate-100 overflow-hidden">

      {/* ── HEADER OVERLAY (over photo) ── */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/65 to-transparent pt-safe">
        <button
          onClick={requestStopWorkout}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors ring-1 ring-white/15"
          aria-label="Arrêter la séance"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center min-w-0 px-2">
          <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest drop-shadow">
            Exercice {exerciseCurrent} / {exerciseTotal}
          </span>
          <span className="text-white text-xs font-bold truncate max-w-[55vw] drop-shadow">
            {program.name}
          </span>
        </div>

        <button
          onClick={() => setIsDrawerOpen(true)}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors ring-1 ring-white/15"
          aria-label="Voir tous les exercices"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── HERO MEDIA ── */}
      <div className="relative w-full aspect-[4/3] bg-slate-900 shrink-0">
        <button
          type="button"
          onClick={() => currentExo.photo_url && setIsMediaZoomOpen(true)}
          className="h-full w-full"
          aria-label="Agrandir l'image"
        >
          <ExerciseImage
            src={currentExo.photo_url}
            alt={currentExo.name}
            className="w-full h-full object-cover"
            fallbackClassName="w-full h-full bg-slate-800"
            iconClassName="h-12 w-12 text-white/40"
          />
        </button>

        {/* Group chip top-right */}
        {isInGroup && (
          <div className="absolute right-4 top-20 inline-flex items-center gap-1.5 rounded-full bg-amber-400/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-900 shadow-md">
            <Layers className="h-3 w-3" />
            {groupLabel} · {currentExerciseInBlockIndex + 1}/{currentBlock.exercises.length}
          </div>
        )}

        {/* Zoom hint */}
        {currentExo.photo_url && !isInGroup && (
          <div className="absolute right-4 top-20 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            <ZoomIn className="h-3 w-3" />
            Agrandir
          </div>
        )}

        {/* Set tracker — flush at the bottom edge of the photo, no overlap */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3 pt-10 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/80 text-[10px] font-extrabold uppercase tracking-widest">
              Série {Math.min(currentRound, blockRoundCount)} / {totalSets}
            </span>
            {currentExo.body_part && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/80 text-[10px] font-bold uppercase tracking-wider">
                  {currentExo.body_part}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
            {Array.from({ length: totalSets }).map((_, i) => (
              <div
                key={i}
                className={`h-full flex-1 rounded-full transition-colors ${
                  i < currentSetIdx
                    ? 'bg-emerald-400'
                    : i === currentSetIdx
                      ? 'bg-emerald-400/70 ring-1 ring-white/40'
                      : 'bg-white/15'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY (sliding sheet) ── */}
      <div className="flex-1 flex flex-col bg-white rounded-t-[28px] -mt-5 z-20 relative px-5 pt-6 pb-32 overflow-y-auto shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.08)]">

        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-black leading-[1.1] text-slate-900 break-words">
              {currentExo.name}
            </h1>

            {/* Variants pill */}
            {variantCandidates.length > 0 && (
              <button
                onClick={() => setShowVariants((p) => !p)}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {showVariants
                  ? 'Masquer variantes'
                  : `${variantCandidates.length} variante${variantCandidates.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          {currentExo.comment && (
            <button
              onClick={() => setIsCommentModalOpen(true)}
              className="h-11 w-11 shrink-0 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors ring-1 ring-blue-100"
              aria-label="Voir le commentaire du coach"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          )}
        </div>

        {showVariants && variantCandidates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {variantCandidates.map((variant) => {
              const variantIndex = exercises.findIndex((ex) => ex.id === variant.id)
              return (
                <Button
                  key={variant.id}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    if (variantIndex >= 0) {
                      selectExercise(variantIndex)
                      setShowVariants(false)
                    }
                  }}
                >
                  {variant.name}
                </Button>
              )
            })}
          </div>
        )}

        {/* Stat row — only meaningful values */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <BigStat label={primaryEffort.label} value={primaryEffort.value} primary />
          <BigStat label="Charge" value={charge ?? '—'} dim={!charge} />
          <BigStat label="Repos" value={rest ?? '—'} dim={!rest} />
        </div>

        {/* Group preview — shows other exos in the same superset/triset */}
        {isInGroup && currentBlock.exercises.length > 1 && (
          <div className="mt-5 rounded-2xl bg-amber-50/50 ring-1 ring-amber-100 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800 mb-2.5">
              {groupLabel} en cours
            </p>
            <ul className="space-y-1.5">
              {currentBlock.exercises.map((ex, idx) => {
                const isCurrent = idx === currentExerciseInBlockIndex
                const isDone = idx < currentExerciseInBlockIndex
                return (
                  <li
                    key={String(ex.id)}
                    className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors ${
                      isCurrent ? 'bg-white ring-1 ring-amber-200 shadow-sm' : ''
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-slate-400 ring-1 ring-slate-200'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={`flex-1 truncate text-sm font-semibold ${
                        isCurrent ? 'text-slate-900' : isDone ? 'text-slate-400 line-through' : 'text-slate-600'
                      }`}
                    >
                      {ex.name}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Timed mode runner (AMRAP/EMOM/Tabata) */}
        {currentBlock && isTimedMode && (
          <div className="mt-5">
            <GroupedExerciseRunner
              mode={executionMode}
              block={currentBlock}
              currentRound={currentRound}
              currentExerciseInBlockIndex={currentExerciseInBlockIndex}
              onCompleteTimedBlock={completeTimedBlock}
              onSetTimedExerciseIndex={setTimedExerciseIndex}
            />
          </div>
        )}
      </div>

      {/* ── FIXED BOTTOM ACTION ── */}
      {!isResting && !isTimedMode && (
        <div className="fixed sm:absolute flex-col bottom-0 inset-x-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent pb-safe z-30">
          <div className="mx-auto w-full sm:max-w-md">
            <Button
              onClick={handleCompleteSet}
              className="w-full h-16 rounded-[24px] bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            >
              <CheckCircle2 className="h-5 w-5" />
              {cta}
            </Button>
          </div>
        </div>
      )}

      {/* ── REST OVERLAY ── */}
      {isResting && (
        <RestTimerView
          duration={currentExo.rest_time || '01:30'}
          nextExerciseName={nextExoName}
          nextSetIndicator={nextSetIndicator}
          onComplete={handleFinishRest}
          onSkip={handleFinishRest}
        />
      )}

      <WorkoutDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        workout={{ name: program.name, exercises }}
        currentExerciseIndex={currentExoIdx}
        onSelectExercise={handleSelectExerciseFromDrawer}
        onStopWorkout={requestStopWorkout}
      />

      {/* Image zoom */}
      <Dialog open={isMediaZoomOpen} onOpenChange={setIsMediaZoomOpen}>
        <DialogContent className="max-w-4xl border-none bg-black/95 p-2">
          <DialogTitle className="sr-only">{currentExo.name}</DialogTitle>
          <DialogDescription className="sr-only">Aperçu agrandi de l'exercice</DialogDescription>
          {currentExo.photo_url && (
            <ExerciseImage
              src={currentExo.photo_url}
              alt={currentExo.name}
              className="max-h-[85vh] w-full rounded-lg object-contain"
              fallbackClassName="max-h-[85vh] w-full min-h-[300px] rounded-lg bg-slate-800"
              iconClassName="h-16 w-16 text-white/40"
            />
          )}
          <div className="mt-2 flex items-center justify-center gap-2 text-white/70 text-xs">
            <Maximize2 className="h-3 w-3" />
            {currentExo.name}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stop confirmation */}
      <Dialog open={isStopConfirmOpen} onOpenChange={setIsStopConfirmOpen}>
        <DialogContent className="sm:max-w-sm rounded-[28px] bg-white border-none p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Arrêter la séance ?</DialogTitle>
            <DialogDescription className="text-center">
              La progression sera enregistrée et tu pourras laisser une appréciation.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsStopConfirmOpen(false)}>
              Continuer
            </Button>
            <Button className="flex-1 rounded-xl bg-red-600 hover:bg-red-700" onClick={handleStopWorkout}>
              Arrêter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coach comment */}
      <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
        <DialogContent className="sm:max-w-sm rounded-[28px] bg-white border-none p-6">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 ring-1 ring-blue-100">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Consigne du coach</DialogTitle>
          </DialogHeader>
          <div className="mt-3 p-4 bg-slate-50 rounded-2xl text-slate-700 text-center leading-relaxed whitespace-pre-line">
            {currentExo.comment || 'Aucune consigne spécifique pour cet exercice.'}
          </div>
          <Button className="w-full mt-5 h-12 rounded-xl font-bold" onClick={() => setIsCommentModalOpen(false)}>
            Compris
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-component                                                              */
/* -------------------------------------------------------------------------- */

function BigStat({
  label,
  value,
  primary = false,
  dim = false,
}: {
  label: string
  value: string
  primary?: boolean
  dim?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-2 py-3.5 ring-1 ${
        primary
          ? 'bg-emerald-50 ring-emerald-100'
          : dim
            ? 'bg-slate-50 ring-slate-100'
            : 'bg-white ring-slate-100'
      }`}
    >
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </span>
      <span
        className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${
          primary ? 'text-emerald-700' : dim ? 'text-slate-300' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
