import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Menu, MessageSquare, X, SlidersHorizontal, CheckCircle2, MoreHorizontal, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useActiveWorkout } from '@/hooks/useActiveWorkout'

// Sub-components
import { WorkoutDrawer } from '@/components/client/workout/WorkoutDrawer'
import { RestTimerView } from '@/components/client/workout/RestTimerView'
import { FeedbackModal } from '@/components/client/workout/FeedbackModal'

const normalizeExecutionMode = (mode?: string | null): 'Superset' | 'Circuit' | 'AMRAP' | 'EMOM' | 'Tabata' => {
  const normalized = String(mode || '').trim().toLowerCase()

  if (!normalized || normalized === 'classique' || normalized === 'classic') return 'Superset'
  if (normalized === 'superset' || normalized.includes('super set')) return 'Superset'
  if (normalized === 'circuit' || normalized.includes('circuit')) return 'Circuit'
  if (normalized === 'amrap' || normalized.includes('amrap')) return 'AMRAP'
  if (normalized === 'emom' || normalized.includes('emom')) return 'EMOM'
  if (normalized === 'tabata' || normalized.includes('tabata')) return 'Tabata'

  return 'Superset'
}

const getAutoGroupLabel = (mode: 'Superset' | 'Circuit' | 'AMRAP' | 'EMOM' | 'Tabata', count: number) => {
  if (mode === 'Superset') {
    if (count >= 4) return 'Circuit'
    if (count === 3) return 'Triset'
    return 'Superset'
  }
  return mode
}

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const toDisplayText = (value?: string | number | null) => {
  if (value === null || value === undefined) return '-'
  const text = String(value).trim()
  return text.length > 0 ? text : '-'
}

const toSetsCount = (value?: string | number | null) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric)
  return 1
}

const getPrimaryEffortValue = (exercise: any) => {
  if (exercise.reps) return { label: 'Répétitions', value: toDisplayText(exercise.reps) }

  if (exercise.reps_min && exercise.reps_max) {
    return { label: 'Répétitions', value: `${exercise.reps_min}-${exercise.reps_max}` }
  }

  const effortType = normalizeText(exercise.effort_type)
  if (effortType.includes('temps') || effortType.includes('duree') || effortType.includes('duration')) {
    return { label: 'Durée', value: toDisplayText(exercise.duration_minutes) }
  }

  if (exercise.duration_minutes) {
    return { label: 'Durée', value: toDisplayText(exercise.duration_minutes) }
  }

  return { label: 'Répétitions', value: '-' }
}

export default function ActiveWorkout() {
  const navigate = useNavigate()
  const { programId } = useParams<{ programId: string }>()

  const {
    program,
    exercises,
    loading,
    error,
    currentExerciseIndex: currentExoIdx,
    currentSetIndex: currentSetIdx,
    isResting,
    isFinished,
    wasStoppedEarly,
    nextSet,
    finishRest,
    selectExercise,
    endWorkout,
    sessionStartTime,
    sessionEndTime
  } = useActiveWorkout(programId)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false)
  const [isMediaZoomOpen, setIsMediaZoomOpen] = useState(false)
  const [showVariants, setShowVariants] = useState(false)
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false)

  const currentExo = exercises[currentExoIdx]

  const variantCandidates = useMemo(() => {
    if (!currentExo) return []

    const currentId = currentExo.id
    const parentId = currentExo.parent_exercise_id

    const related = exercises.filter((exercise) => {
      if (exercise.id === currentId) return false

      if (parentId) {
        return exercise.id === parentId || exercise.parent_exercise_id === parentId
      }

      return exercise.parent_exercise_id === currentId
    })

    return related.sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [exercises, currentExo?.id, currentExo?.parent_exercise_id])

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">Chargement...</div></div>
  }

  if (error || !program || exercises.length === 0 || !currentExo) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-red-500">Erreur: {error || 'Programme vide'}</div></div>
  }

  const totalSets = toSetsCount(currentExo.sets)
  const normalizedMode = normalizeExecutionMode(currentExo.execution_mode || currentExo.type)
  const groupedExercises = currentExo.superset_id
    ? exercises.filter((exo) => exo.superset_id === currentExo.superset_id)
    : []
  const isGroupedExercise = groupedExercises.length > 1
  const displayExecutionType = getAutoGroupLabel(normalizedMode, groupedExercises.length)
  const isCircuitStyle = ['Circuit', 'AMRAP', 'EMOM', 'Tabata'].includes(displayExecutionType)
  const currentGroupPosition = isGroupedExercise
    ? groupedExercises.findIndex((exo) => exo.id === currentExo.id) + 1
    : null
  const currentSetDisplay = `${Math.min(currentSetIdx + 1, totalSets)}/${totalSets}`

  const primaryEffort = getPrimaryEffortValue(currentExo)

  // Handlers
  const handleCompleteSet = () => {
    nextSet()
  }

  const handleFinishRest = () => {
    finishRest()
  }

  const requestStopWorkout = () => {
    setIsStopConfirmOpen(true)
  }

  const handleStopWorkout = () => {
    endWorkout(true)
    setIsStopConfirmOpen(false)
    setIsDrawerOpen(false)
  }

  const handleCloseFeedback = () => {
    // Feedback finished -> redirect to dashboard
    navigate('/client/dashboard')
  }

  const handleSelectExerciseFromDrawer = (index: number) => {
    selectExercise(index)
    setIsDrawerOpen(false)
  }

  // Next context for the Rest Timer
  const isLastSet = currentSetIdx === totalSets - 1
  const isLastExo = currentExoIdx === exercises.length - 1
  let nextExoName = currentExo.name
  let nextSetIndicator = `Série ${currentSetIdx + 2} sur ${totalSets}`

  if (isLastSet && !isLastExo) {
    nextExoName = exercises[currentExoIdx + 1].name
    nextSetIndicator = `Série 1 sur ${exercises[currentExoIdx + 1].sets || 1}`
  }

  // Modals for comments and details
  const CommentModal = () => (
    <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
      <DialogContent className="sm:max-w-sm rounded-[32px] bg-white border-none p-6">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="h-6 w-6 text-blue-500" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">Consignes du Coach</DialogTitle>
        </DialogHeader>
        <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-slate-700 text-center leading-relaxed">
          {currentExo.comment || "Aucune consigne spécifique pour cet exercice."}
        </div>
        <Button className="w-full mt-6 h-12 rounded-xl font-bold" onClick={() => setIsCommentModalOpen(false)}>Compris</Button>
      </DialogContent>
    </Dialog>
  )

  if (isFinished) {
    const durationMinutes = sessionStartTime && sessionEndTime 
      ? Math.round((sessionEndTime.getTime() - sessionStartTime.getTime()) / 60000) 
      : 0;

    // In FeedbackModal, we'll need to pass the program data to save the logs
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

  return (
    <div className="min-h-screen bg-white relative flex flex-col sm:max-w-md sm:mx-auto sm:border-x sm:border-slate-100 overflow-hidden">
      
      {/* ── HEADER OVERLAY ── */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent pt-safe">
        <button onClick={requestStopWorkout} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors">
          <X className="h-5 w-5" />
        </button>
        <span className="text-white font-bold text-xs tracking-wider uppercase drop-shadow-md">
          {program.name}
        </span>
        <button onClick={() => setIsDrawerOpen(true)} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── MAIN MEDIA SECTION ── */}
      <div className="relative w-full aspect-[4/3] bg-slate-900 shrink-0">
        <button
          type="button"
          onClick={() => currentExo.photo_url && setIsMediaZoomOpen(true)}
          className="h-full w-full"
        >
          {currentExo.photo_url ? (
            <img src={currentExo.photo_url} alt={currentExo.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800">
              <Dumbbell className="h-12 w-12 text-white/40" />
            </div>
          )}
        </button>

        {currentExo.photo_url && (
          <div className="absolute right-4 bottom-4 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
            Appuyer pour agrandir
          </div>
        )}

        {/* Bottom Gradient / Progress Indicator inside media */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-slate-900 to-transparent flex items-end px-4 py-4">
          <div className="w-full flex items-center gap-4">
            <span className="text-white text-xs font-bold font-mono">00:00</span>
            <div className="flex-1 flex gap-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              {Array.from({length: totalSets}).map((_, i) => (
                <div 
                  key={i} 
                  className={`h-full flex-1 rounded-full ${i < currentSetIdx ? 'bg-[#10b981]' : i === currentSetIdx ? 'bg-[#10b981]/60' : 'bg-white/20'}`}
                />
              ))}
            </div>
            <span className="text-white text-xs font-bold font-mono">03:00</span>
          </div>
        </div>
      </div>

      {/* ── EXERCISE DETAILS SECTION ── */}
      <div className="flex-1 flex flex-col bg-[#fbfbfb] rounded-t-[32px] -mt-6 z-20 relative px-6 py-8 pb-32 overflow-y-auto">
        
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">
                Série {currentSetDisplay}
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              {currentExo.name}
            </h1>
          </div>
          {currentExo.comment && (
            <button 
              onClick={() => setIsCommentModalOpen(true)}
              className="mt-1 h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 hover:bg-blue-100 transition-colors"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          )}
        </div>

        {variantCandidates.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowVariants((prev) => !prev)}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal className="h-3 w-3" />
              {showVariants ? 'Masquer variantes' : `Voir ${variantCandidates.length} variante(s)`}
            </button>

            {showVariants && (
              <div className="mt-3 flex flex-wrap gap-2">
                {variantCandidates.map((variant) => {
                  const variantIndex = exercises.findIndex((exercise) => exercise.id === variant.id)
                  return (
                    <Button
                      key={variant.id}
                      variant="outline"
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
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {(isGroupedExercise || isCircuitStyle) && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              Circuit détecté • Type: {displayExecutionType}
            </span>
          )}
          {currentGroupPosition && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              Exercice {currentGroupPosition}/{groupedExercises.length} du groupe
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
            Zone: {currentExo.body_part || 'Non précisée'}
          </span>
        </div>

        {/* Target Parameters Cards */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Charge</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{toDisplayText(currentExo.charge)}</span>
              {currentExo.charge_type && <span className="text-xs font-bold text-slate-400">{currentExo.charge_type}</span>}
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{primaryEffort.label}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{primaryEffort.value}</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Récup</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{toDisplayText(currentExo.rest_time)}</span>
            </div>
          </div>

        </div>

        {/* Rest Time Info */}
        <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-sm font-semibold bg-white py-3 rounded-2xl border border-slate-100">
          <MoreHorizontal className="h-4 w-4" /> Repos prévu: <span className="text-slate-900 font-bold">{currentExo.rest_time}</span>
        </div>

      </div>

      {/* ── FIXED BOTTOM ACTION ── */}
      {!isResting && (
        <div className="absolute flex-col bottom-0 inset-x-0 p-4 bg-gradient-to-t from-white via-white to-transparent pb-safe z-30">
          <Button 
            onClick={handleCompleteSet}
            className="w-full h-16 rounded-[24px] bg-[#10b981] hover:bg-[#059669] text-white font-bold text-lg shadow-xl shadow-[#10b981]/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <CheckCircle2 className="h-6 w-6" />
            Série terminée
          </Button>
        </div>
      )}

      {/* Overlays */}
      {isResting && (
        <RestTimerView 
          duration={currentExo.rest_time || "01:30"} 
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

      <Dialog open={isMediaZoomOpen} onOpenChange={setIsMediaZoomOpen}>
        <DialogContent className="max-w-4xl border-none bg-black/95 p-2">
          {currentExo.photo_url && (
            <img
              src={currentExo.photo_url}
              alt={currentExo.name}
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isStopConfirmOpen} onOpenChange={setIsStopConfirmOpen}>
        <DialogContent className="sm:max-w-sm rounded-[28px] bg-white border-none p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Arrêter la séance ?</DialogTitle>
            <DialogDescription className="text-center">
              La progression sera enregistrée et vous pourrez laisser une appréciation.
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

      <CommentModal />

    </div>
  )
}
