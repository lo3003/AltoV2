import { useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { X, CheckCircle2 } from 'lucide-react'

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

interface WorkoutDrawerProps {
  isOpen: boolean
  onClose: () => void
  workout: any
  currentExerciseIndex: number
  onSelectExercise: (index: number) => void
  onStopWorkout: () => void
}

const toDisplayText = (value?: string | number | null) => {
  if (value === null || value === undefined) return '-'
  const text = String(value).trim()
  return text.length > 0 ? text : '-'
}

const getPrimaryEffort = (exercise: any) => {
  if (exercise.reps) return toDisplayText(exercise.reps)
  if (exercise.reps_min && exercise.reps_max) return `${exercise.reps_min}-${exercise.reps_max}`
  if (exercise.duration_minutes) return toDisplayText(exercise.duration_minutes)
  return '-'
}

export function WorkoutDrawer({ isOpen, onClose, workout, currentExerciseIndex, onSelectExercise, onStopWorkout }: WorkoutDrawerProps) {
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)

  const exercisesCount = useMemo(() => workout.exercises.length, [workout.exercises.length])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-[#fbfbfb] border-none">
        
        {/* Header */}
        <div className="px-6 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
          <div>
            <SheetTitle className="text-xl font-black text-slate-900">{workout.name}</SheetTitle>
            <SheetDescription className="text-sm font-medium text-slate-500 mt-1">
              Aperçu de la séance • {exercisesCount} exercices
            </SheetDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {workout.exercises.map((exo: any, index: number) => {
            const isCurrent = index === currentExerciseIndex
            const isPast = index < currentExerciseIndex
            const normalizedMode = normalizeExecutionMode(exo.execution_mode || exo.type)
            const groupedItemsCount = exo.superset_id
              ? workout.exercises.filter((item: any) => item.superset_id === exo.superset_id).length
              : 1
            const displayExecutionType = getAutoGroupLabel(normalizedMode, groupedItemsCount)
            const isCircuitStyle = ['Circuit', 'AMRAP', 'EMOM', 'Tabata'].includes(displayExecutionType)

            return (
              <div 
                key={exo.id}
                onClick={() => setExpandedExerciseId((prev) => (prev === exo.id ? null : exo.id))}
                className={`group flex items-center gap-4 p-4 rounded-[24px] border-2 cursor-pointer transition-all ${
                  isCurrent 
                    ? 'border-[#10b981] bg-[#10b981]/5 shadow-sm' 
                    : 'border-transparent bg-white hover:border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center gap-4">
                    {/* Image Thumbnail */}
                    <div className="relative h-16 w-16 rounded-2xl overflow-hidden shrink-0 bg-slate-100">
                      {exo.photo_url ? (
                        <img src={exo.photo_url} alt={exo.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                          <span className="text-slate-400 font-bold text-xs">{exo.name?.substring(0, 2).toUpperCase() || 'EX'}</span>
                        </div>
                      )}
                      {isPast && (
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center backdrop-blur-[1px]">
                          <CheckCircle2 className="h-6 w-6 text-white drop-shadow-md" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-[#10b981]' : 'text-slate-900'}`}>
                          {exo.name}
                        </h4>
                        {isCurrent && <span className="px-2 py-0.5 rounded-full bg-[#10b981] text-white text-[9px] font-black uppercase tracking-wider">Actif</span>}
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        {toDisplayText(exo.sets)} séries • {getPrimaryEffort(exo)}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
                        {isCircuitStyle ? `Type: ${displayExecutionType}` : `Mode: ${displayExecutionType}`} • Zone: {exo.body_part || 'Non précisée'}
                      </p>
                    </div>
                  </div>

                  {expandedExerciseId === exo.id && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Charge</p>
                          <p className="text-xs font-bold text-slate-800 mt-1">{toDisplayText(exo.charge)} {exo.charge_type || ''}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rép/Temps</p>
                          <p className="text-xs font-bold text-slate-800 mt-1">{getPrimaryEffort(exo)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Récup</p>
                          <p className="text-xs font-bold text-slate-800 mt-1">{toDisplayText(exo.rest_time)}</p>
                        </div>
                      </div>

                      {exo.comment && (
                        <p className="rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                          {exo.comment}
                        </p>
                      )}

                      <Button
                        className="w-full rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-bold"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelectExercise(index)
                          onClose()
                        }}
                      >
                        Aller à cet exercice
                      </Button>
                    </div>
                  )}
                </div>

              </div>
            )
          })}
        </div>

        {/* Footer Area */}
        <div className="p-6 bg-white border-t border-slate-100">
          <Button 
            variant="destructive" 
            className="w-full h-14 rounded-2xl font-bold text-base bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none border-none"
            onClick={() => {
              onClose()
              onStopWorkout()
            }}
          >
            Arrêter la séance
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  )
}
