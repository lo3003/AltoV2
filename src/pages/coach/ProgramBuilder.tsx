import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, Dumbbell, Plus,
  GripVertical, Trash2, ChevronDown, ChevronUp, Link2, Repeat, Clock,
  Library, X, ArrowUpAZ, ArrowDownAZ, Layers as LayersIcon, Sparkles, CheckCircle2
} from 'lucide-react'
import { useExerciseLibrary } from '@/hooks/useExerciseLibrary'
import { useProgramEditor, normalizeExecutionMode, type ExecutionMode } from '@/hooks/useProgramEditor'

// Import dnd-kit context
import { 
  DndContext, 
  PointerSensor, 
  TouchSensor, 
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  pointerWithin,
  closestCenter
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { 
  SortableContext, 
  verticalListSortingStrategy, 
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** 
 * Sortable Items Wrappers 
 */
function SortableSoloExercise({ item, onUpdate, onDelete, isGrouped }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const [isExpanded, setIsExpanded] = useState(false)
  const numSets = Number(item.sets) || 0

  const parseNumeric = (value: string) => {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const handleSetDetailChange = (index: number, field: string, value: string) => {
    const currentDetails = Array.isArray(item.set_details) ? [...item.set_details] : []
    while (currentDetails.length < numSets) {
      currentDetails.push({})
    }
    currentDetails[index] = { ...currentDetails[index], [field]: value }
    onUpdate(item.id, 'set_details', currentDetails)
  }

  // Droppable zone over the whole card for grouping
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `solo-drop-${item.id}` })

  return (
    <div ref={setDropRef} className="relative">
      {/* We need the inner to be sortable, the outer to be droppable.
          Drag listeners are applied on the WHOLE card so a long-press
          anywhere (mobile) or click+drag of 8px (desktop) starts the move.
          On mobile, the TouchSensor requires a 400ms hold before triggering. */}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`rounded-[24px] bg-white p-4 shadow-sm transition-all flex flex-col relative z-50 select-none ${isOver ? 'ring-2 ring-[#10b981]/50 bg-[#10b981]/5' : ''} ${isGrouped ? 'border border-slate-100 mb-2' : 'border border-slate-200 mb-4'}`}
      >
       <div className="flex items-center justify-between gap-4 flex-wrap">
         <div className="flex items-center gap-4">
            <span className="text-slate-300 p-1 cursor-grab active:cursor-grabbing" aria-hidden>
              <GripVertical className="h-5 w-5" />
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 shrink-0 border border-slate-200/50 overflow-hidden relative">
              {item.photo_url ? (
                <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <Dumbbell className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#10b981] transition-colors">{item.name}</h4>
              <p className="text-xs text-slate-400 font-medium">{item.body_part || 'Toutes zones'}</p>
            </div>
         </div>

         <div className="flex items-center gap-2 flex-wrap sm:gap-4 sm:ml-auto sm:flex-nowrap">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Sets</p>
              <Input value={item.sets || ''} onChange={e => {
                onUpdate(item.id, 'sets', e.target.value)
              }} className="h-9 w-14 text-center text-sm font-bold rounded-lg border-slate-200" />
            </div>

            {/* Reps / Effort cell: adapts to effort_type */}
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Effort</p>
              <div className="flex items-center gap-1">
                <Select
                  value={item.effort_type || 'fixed'}
                  onValueChange={(val) => onUpdate(item.id, 'effort_type', val)}
                >
                  <SelectTrigger className="h-9 w-[100px] rounded-lg bg-slate-50 border-slate-200 text-[11px] font-bold text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Rép</SelectItem>
                    <SelectItem value="range">Entre…</SelectItem>
                    <SelectItem value="time">Temps</SelectItem>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="intensity">Intensité</SelectItem>
                    <SelectItem value="max_reps">Max rép</SelectItem>
                    <SelectItem value="max_time">Max temps</SelectItem>
                  </SelectContent>
                </Select>

                {(item.effort_type || 'fixed') === 'fixed' && (
                  <Input
                    value={item.reps || ''}
                    onChange={e => onUpdate(item.id, 'reps', e.target.value)}
                    placeholder="10"
                    className="h-9 w-16 text-center text-sm font-bold rounded-lg border-slate-200"
                  />
                )}

                {item.effort_type === 'range' && (
                  <div className="flex items-center gap-1">
                    <Input
                      value={item.reps_min ?? ''}
                      onChange={e => onUpdate(item.id, 'reps_min', parseNumeric(e.target.value))}
                      placeholder="8"
                      className="h-9 w-12 text-center text-sm font-bold rounded-lg border-slate-200"
                    />
                    <span className="text-xs font-bold text-slate-400">-</span>
                    <Input
                      value={item.reps_max ?? ''}
                      onChange={e => onUpdate(item.id, 'reps_max', parseNumeric(e.target.value))}
                      placeholder="12"
                      className="h-9 w-12 text-center text-sm font-bold rounded-lg border-slate-200"
                    />
                  </div>
                )}

                {item.effort_type === 'time' && (
                  <Input
                    value={item.duration_minutes || ''}
                    onChange={e => onUpdate(item.id, 'duration_minutes', e.target.value)}
                    placeholder="00:45"
                    className="h-9 w-20 text-center text-sm font-mono font-bold rounded-lg border-slate-200"
                  />
                )}

                {item.effort_type === 'distance' && (
                  <Input
                    value={item.reps || ''}
                    onChange={e => onUpdate(item.id, 'reps', e.target.value)}
                    placeholder="5 km"
                    className="h-9 w-20 text-center text-sm font-bold rounded-lg border-slate-200"
                  />
                )}

                {item.effort_type === 'intensity' && (
                  <Select
                    value={item.intensity || ''}
                    onValueChange={(val) => onUpdate(item.id, 'intensity', val)}
                  >
                    <SelectTrigger className="h-9 w-[100px] rounded-lg bg-slate-50 border-slate-200 text-[11px] font-bold text-slate-700">
                      <SelectValue placeholder="Niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Faible">Faible</SelectItem>
                      <SelectItem value="Modérée">Modérée</SelectItem>
                      <SelectItem value="Élevée">Élevée</SelectItem>
                      <SelectItem value="Maximale">Maximale</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {item.effort_type === 'max_reps' && (
                  <Badge className="h-9 px-2 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider border-none flex items-center">
                    AMAP
                  </Badge>
                )}

                {item.effort_type === 'max_time' && (
                  <Badge className="h-9 px-2 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider border-none flex items-center">
                    Max
                  </Badge>
                )}
              </div>
            </div>

            {/* Type de charge (unité) — petit sélecteur inline, sans valeur globale.
                La valeur de charge se définit par série dans le panneau déroulant. */}
            <div className="text-center">
               <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Unité</p>
               <Select
                 value={item.charge_type || 'kg'}
                 onValueChange={(val) => onUpdate(item.id, 'charge_type', val)}
               >
                 <SelectTrigger className="h-9 w-[78px] rounded-lg bg-slate-50 border-slate-200 text-[11px] font-bold text-slate-700">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="kg">kg</SelectItem>
                   <SelectItem value="PDC">PDC</SelectItem>
                   <SelectItem value="Nv">Niveau</SelectItem>
                   <SelectItem value="none">Aucune</SelectItem>
                 </SelectContent>
               </Select>
            </div>

            <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-all mt-[18px] p-2">
              <Trash2 className="h-4 w-4" />
            </button>

            {numSets > 0 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="text-slate-400 hover:text-[#10b981] transition-all mt-[18px] p-2 hover:bg-[#10b981]/10 rounded-lg"
                title="Détails des séries"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
         </div>
       </div>

       {/* Custom effort detail for cardio (free text: e.g. "5 min à 8 km/h, IC 4-5") */}
       {item.type === 'Cardio' && (
         <div className="mt-3 sm:ml-12 ml-0 flex items-center gap-2 bg-slate-50/70 rounded-xl px-3 py-2 border border-slate-100">
           <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Détail effort</span>
           <Input
             value={item.effort_detail || ''}
             onChange={e => onUpdate(item.id, 'effort_detail', e.target.value)}
             placeholder="Ex: 5 min à 8 km/h, IC 4-5"
             className="h-8 flex-1 text-sm border-none shadow-none bg-transparent focus-visible:ring-1 focus-visible:ring-[#10b981]/30"
           />
         </div>
       )}

       {isExpanded && numSets > 0 && (
         <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-3">
           {Array.from({ length: numSets }).map((_, index) => {
             const detail = item.set_details?.[index] || {}
             return (
               <div key={index} className="flex items-center gap-4 bg-slate-50/50 p-2.5 rounded-xl sm:ml-12 ml-0">
                 <div className="w-16 flex justify-center">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Série {index + 1}</span>
                 </div>
                 <div className="flex items-center gap-3 w-full flex-wrap">
                   {/* Order: Charge | Réps | Récup */}
                   <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-1.5 border border-slate-100 min-w-[100px]">
                     <span className="text-[10px] uppercase font-bold text-slate-400 w-12 sm:w-16 text-center">Charge</span>
                     <Input
                       value={detail.charge !== undefined ? detail.charge : (item.charge || '')}
                       onChange={e => handleSetDetailChange(index, 'charge', e.target.value)}
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30 bg-transparent"
                       placeholder={String(item.charge || '')}
                     />
                   </div>
                   <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-1.5 border border-slate-100 min-w-[100px]">
                     <span className="text-[10px] uppercase font-bold text-slate-400 w-10 sm:w-12 text-center">Réps</span>
                     <Input
                       value={detail.reps !== undefined ? detail.reps : (item.reps || '')}
                       onChange={e => handleSetDetailChange(index, 'reps', e.target.value)}
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30 bg-transparent"
                       placeholder={String(item.reps || '')}
                     />
                   </div>
                   <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-1.5 border border-slate-100 min-w-[100px]">
                     <span className="text-[10px] uppercase font-bold text-slate-400 w-10 sm:w-12 text-center">Récup</span>
                     <Input
                       value={detail.recup !== undefined ? detail.recup : (item.rest_time || '')}
                       onChange={e => handleSetDetailChange(index, 'recup', e.target.value)}
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30 bg-transparent"
                       placeholder={String(item.rest_time || '01:30')}
                     />
                   </div>
                 </div>
               </div>
             )
           })}
         </div>
       )}
      </div>
    </div>
  )
}

function SortableSeparator({ item, onDelete, isFirst = false }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-4 mb-4 select-none ${isFirst ? 'mt-0' : 'mt-8'}`}
    >
       <span className="text-slate-300 p-1 cursor-grab active:cursor-grabbing" aria-hidden>
          <GripVertical className="h-5 w-5" />
       </span>
       <div className="flex-1 h-px bg-slate-200"></div>
       <Badge variant="outline" className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 bg-white uppercase tracking-widest shadow-sm">
         {item.name}
       </Badge>
       <div className="flex-1 h-px bg-slate-200"></div>
       <button
         onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
         onPointerDown={(e) => e.stopPropagation()}
         className="text-slate-300 hover:text-red-500 transition-all p-2"
       >
         <Trash2 className="h-4 w-4" />
       </button>
    </div>
  )
}

function DraggableLibraryCard({ exo }: { exo: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${exo.id}`,
    data: { type: 'exercise', exercise: exo }
  })

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes}
      className={`group flex flex-col items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#10b981]/30 hover:shadow-md cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex gap-4 pointer-events-none">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 overflow-hidden relative border border-slate-200/50">
          {exo.photo_url ? (
            <img src={exo.photo_url} alt={exo.name} className="w-full h-full object-cover" />
          ) : (
            <Dumbbell className="h-5 w-5 text-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-[#10b981] transition-colors">{exo.name}</h3>
          <p className="truncate text-xs font-medium text-slate-500 mt-0.5">{exo.body_part || 'Toutes zones'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exo.charge_type && <Badge variant="secondary" className="rounded-md bg-slate-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-100">{exo.charge_type}</Badge>}
            {(exo.sets || exo.reps) && <Badge variant="secondary" className="rounded-md bg-slate-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-100">{exo.sets && exo.reps ? `${exo.sets}x${exo.reps}` : exo.sets || exo.reps}</Badge>}
          </div>
        </div>
      </div>
    </div>
  )
}

function DraggableSeparatorBtn({ name, icon }: { name: string, icon: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-sep-${name}`,
    data: { type: 'separator', name }
  })
  
  return (
    <Button 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variant="outline" 
      className={`w-full justify-start h-10 rounded-xl bg-white border-dashed text-xs font-bold text-slate-500 hover:text-slate-900 shadow-sm gap-2 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
        {icon && <Plus className="h-3.5 w-3.5" />} {name}
    </Button>
  )
}

function DroppableExecutionModeCard({
  mode,
  subtitle,
}: {
  mode: ExecutionMode
  subtitle: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `create-group-${mode}` })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-dashed bg-white px-3 py-2 transition-all ${
        isOver ? 'border-[#10b981] bg-[#10b981]/5 ring-2 ring-[#10b981]/20' : 'border-slate-200'
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">{mode}</p>
      <p className="mt-0.5 text-[10px] font-medium text-slate-400">{subtitle}</p>
    </div>
  )
}

function CanvasDropZone({
  children,
}: {
  children: (params: { isOver: boolean; setNodeRef: (element: HTMLElement | null) => void }) => React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' })
  return <>{children({ isOver, setNodeRef })}</>
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function SortIcon({ sort }: { sort: 'name_asc' | 'name_desc' | 'type' | 'body' }) {
  switch (sort) {
    case 'name_desc':
      return <ArrowDownAZ className="h-3.5 w-3.5" />
    case 'type':
      return <LayersIcon className="h-3.5 w-3.5" />
    case 'body':
      return <Sparkles className="h-3.5 w-3.5" />
    case 'name_asc':
    default:
      return <ArrowUpAZ className="h-3.5 w-3.5" />
  }
}

function hasActiveLibraryFilter(query: string, typeFilter: string, muscleFilter: string): boolean {
  return query.trim().length > 0 || typeFilter !== 'TOUT' || muscleFilter !== 'TOUT'
}

export default function ProgramBuilder() {
  const navigate = useNavigate()
  const { id: pathProgramId } = useParams()
  const [searchParams] = useSearchParams()

  const searchProgramId = searchParams.get('programId')
  const clientId = searchParams.get('clientId')
  const returnPath = clientId
    ? `/coach/clients/${encodeURIComponent(clientId)}`
    : '/coach/programs'
  const handleNavigateBack = () => {
    navigate(returnPath, { replace: Boolean(clientId) })
  }
  const resolvedProgramId = (searchProgramId && searchProgramId !== 'new' ? searchProgramId : pathProgramId) || 'new'
  const programId = resolvedProgramId

  const {
      program,
      items,
      loading: isProgramLoading,
      isSaving,
      handleProgramChange,
      handleUpdateItemField,
      handleUpdateGroupField,
      handleAddItem,
      handleDeleteItem,
      handleMoveItem,
      handleGroupItems,
      handleChangeExecutionMode,
      handleUngroupItem,
      handleSaveProgram,
  } = useProgramEditor(programId, undefined, { clientId })

  // Track active drag for overlay
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragData, setActiveDragData] = useState<any>(null)

  const { exercises: libraryExercises, loading: isLibraryLoading } = useExerciseLibrary()

  const [searchQuery, setSearchQuery] = useState('')
  const [isLibraryOpenMobile, setIsLibraryOpenMobile] = useState(false)
  const [librarySort, setLibrarySort] = useState<'name_asc' | 'name_desc' | 'type' | 'body'>('name_asc')
  const [recentlyAddedExoId, setRecentlyAddedExoId] = useState<string | null>(null)
  const [muscleFilter, setMuscleFilter] = useState('TOUT')
  const [typeFilter, setTypeFilter] = useState<'TOUT' | 'Renforcement' | 'Cardio' | 'Étirement' | 'Mobilité'>('TOUT')
  const isSameItemId = (left: unknown, right: unknown) => String(left) === String(right)

  const getAutoGroupLabel = (mode: ExecutionMode, count: number) => {
    if (mode === 'Superset') {
      if (count >= 4) return 'Circuit'
      if (count === 3) return 'Triset'
      return 'Superset'
    }
    return mode
  }

  const parseNumeric = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const normalizeForCompare = (value?: string | null) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()

  const filteredLibrary = libraryExercises.filter((exo) => {
    const matchSearch = exo.name.toLowerCase().includes(searchQuery.toLowerCase())

    let matchMuscle = true
    if (muscleFilter !== 'TOUT') {
      const bp = (exo.body_part || '').toLowerCase()
      if (muscleFilter === 'PECTORAUX' && !bp.includes('pect') && !bp.includes('chest')) matchMuscle = false
      if (muscleFilter === 'DOS' && !bp.includes('dos') && !bp.includes('back')) matchMuscle = false
      if (muscleFilter === 'JAMBES' && !bp.includes('jambe') && !bp.includes('leg') && !bp.includes('fess')) matchMuscle = false
    }

    let matchType = true
    if (typeFilter !== 'TOUT') {
      matchType = normalizeForCompare(exo.type) === normalizeForCompare(typeFilter)
    }

    return matchSearch && matchMuscle && matchType
  })

  // Sort library exercises (mobile sheet)
  const sortedLibrary = [...filteredLibrary].sort((a, b) => {
    const aName = a.name || ''
    const bName = b.name || ''
    switch (librarySort) {
      case 'name_desc':
        return bName.localeCompare(aName, 'fr')
      case 'type':
        return (a.type || '').localeCompare(b.type || '', 'fr') || aName.localeCompare(bName, 'fr')
      case 'body':
        return (a.body_part || '').localeCompare(b.body_part || '', 'fr') || aName.localeCompare(bName, 'fr')
      case 'name_asc':
      default:
        return aName.localeCompare(bName, 'fr')
    }
  })

  /**
   * Add an exercise from the mobile library sheet.
   * Shows a brief visual confirmation + a toast + optional haptic vibration.
   * The sheet stays open so the coach can add multiple exos in a row.
   */
  const handleAddExoFromMobileSheet = (exo: any) => {
    handleAddItem(exo)

    // Visual flash on the tapped card
    setRecentlyAddedExoId(String(exo.id))
    window.setTimeout(() => setRecentlyAddedExoId(null), 700)

    // Tiny haptic on supporting devices
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(15) } catch { /* ignore */ }
    }

    toast.success(`« ${exo.name} » ajouté`, {
      duration: 1500,
      position: 'top-center',
    })
  }

  const handleAddSeparatorFromMobileSheet = (name: string) => {
    handleAddItem({ type: 'separator', name })
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(15) } catch { /* ignore */ }
    }
    toast.success(`Section « ${name} » ajoutée`, {
      duration: 1500,
      position: 'top-center',
    })
  }

  // DND Handlers
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Mobile: require a clear long-press (400ms) before drag activates,
    // otherwise scrolling vertically would accidentally pick up an item.
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } })
  )

  // Custom collision detection to handle both reordering and grouping
  const customCollision = (args: any) => {
    const pointerCollisions = pointerWithin(args)

    const modeDropHit = pointerCollisions.find((collision) =>
      String(collision.id).startsWith('create-group-')
    )
    if (modeDropHit) return [modeDropHit]

    const groupItemDropHit = pointerCollisions.find((collision) =>
      String(collision.id).startsWith('solo-drop-')
    )
    if (groupItemDropHit) return [groupItemDropHit]

    const canvasDropHit = pointerCollisions.find((collision) => String(collision.id) === 'canvas-drop-zone')
    if (canvasDropHit) return [canvasDropHit]

    return closestCenter(args)
  }

  const getModeFromDropId = (dropId: string): ExecutionMode | null => {
    if (!dropId.startsWith('create-group-')) return null
    return normalizeExecutionMode(dropId.replace('create-group-', ''))
  }

  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id)
    setActiveDragData(event.active.data.current)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    setActiveDragData(null)
    
    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const modeFromDropZone = getModeFromDropId(overIdStr)

    // 1. Library drag dropping
    if (activeIdStr.startsWith('library-') || activeIdStr.startsWith('lib-sep-')) {
      const data = active.data.current as any
      if (!data) return
      
      const overItemIndex = items.findIndex((i) => isSameItemId(i.id, over.id))

      let newItemObj: any = null
      if (data.type === 'separator') {
        newItemObj = { type: 'separator', name: data.name }
      } else if (data.type === 'exercise') {
        newItemObj = data.exercise
      }
      
      if (newItemObj) {
        if (modeFromDropZone && data.type === 'exercise') {
          const matchingGroupItems = items.filter(
            (it) =>
              !it.is_section_header &&
              !!it.superset_id &&
              normalizeExecutionMode(it.execution_mode) === modeFromDropZone
          )

          if (matchingGroupItems.length > 0) {
            const matchingSupersetId = matchingGroupItems[0].superset_id!
            const insertionIndex = items.reduce((lastIndex, currentItem, currentIndex) => {
              if (currentItem.superset_id === matchingSupersetId) {
                return currentIndex
              }
              return lastIndex
            }, -1)

            handleAddItem(newItemObj, {
              insertAt: insertionIndex === -1 ? undefined : insertionIndex + 1,
              supersetId: matchingSupersetId,
              executionMode: modeFromDropZone,
            })
          } else {
            const legacyModeItemsWithoutGroup = items.filter(
              (it) =>
                !it.is_section_header &&
                !it.superset_id &&
                normalizeExecutionMode(it.execution_mode || it.type) === modeFromDropZone
            )

            if (legacyModeItemsWithoutGroup.length > 0) {
              const legacySupersetId = crypto.randomUUID()

              legacyModeItemsWithoutGroup.forEach((legacyItem) => {
                handleUpdateItemField(legacyItem.id, 'superset_id', legacySupersetId)
                handleUpdateItemField(legacyItem.id, 'execution_mode', modeFromDropZone)
              })

              const insertionIndex = items.reduce((lastIndex, currentItem, currentIndex) => {
                if (legacyModeItemsWithoutGroup.some((legacyItem) => isSameItemId(legacyItem.id, currentItem.id))) {
                  return currentIndex
                }
                return lastIndex
              }, -1)

              handleAddItem(newItemObj, {
                insertAt: insertionIndex === -1 ? undefined : insertionIndex + 1,
                supersetId: legacySupersetId,
                executionMode: modeFromDropZone,
              })
            } else {
              handleAddItem(newItemObj, {
                supersetId: crypto.randomUUID(),
                executionMode: modeFromDropZone,
              })
            }
          }
          return
        }

        if (overIdStr === 'canvas-drop-zone') {
          handleAddItem(newItemObj)
          return
        }

        // If dropping directly onto an item card
        if (overIdStr.startsWith('solo-drop-')) {
          const targetItemId = overIdStr.replace('solo-drop-', '')
          const targetItem = items.find((it) => isSameItemId(it.id, targetItemId))
          const targetIndex = items.findIndex((it) => isSameItemId(it.id, targetItemId))

          // Separators dropped onto a card → insert just BEFORE the target card
          if (data.type === 'separator' && targetIndex !== -1) {
            handleAddItem(newItemObj, { insertAt: targetIndex })
            return
          }

          if (data.type === 'exercise' && targetItem && !targetItem.is_section_header) {
            const newSupersetId = targetItem.superset_id || crypto.randomUUID()
            const targetMode = targetItem.superset_id
              ? normalizeExecutionMode(targetItem.execution_mode)
              : 'Superset'

            const baseGroupCount = targetItem.superset_id
              ? items.filter((it) => it.superset_id === targetItem.superset_id).length
              : 1
            const nextGroupCount = baseGroupCount + 1
            const autoExecutionMode: ExecutionMode =
              targetMode === 'Superset' || targetMode === 'Circuit'
                ? (nextGroupCount >= 4 ? 'Circuit' : 'Superset')
                : targetMode

            handleAddItem(newItemObj, {
              insertAt: targetIndex === -1 ? undefined : targetIndex + 1,
              supersetId: newSupersetId,
              executionMode: autoExecutionMode,
            })

            if (!targetItem.superset_id) {
              handleUpdateItemField(targetItemId, 'superset_id', newSupersetId)
              handleUpdateItemField(targetItemId, 'execution_mode', autoExecutionMode)
            }
          } else {
            handleAddItem(newItemObj)
          }
        } else if (overItemIndex !== -1) {
          handleAddItem(newItemObj, { insertAt: overItemIndex + 1 })
        } else {
          handleAddItem(newItemObj)
        }
      }
      return
    }

    // 2. Convert/create typed groups from canvas drag
    if (modeFromDropZone) {
      const activeItem = items.find((item) => isSameItemId(item.id, activeIdStr))
      if (!activeItem || activeItem.is_section_header) return

      if (activeItem.superset_id) {
        handleChangeExecutionMode(activeItem.superset_id, modeFromDropZone)
      } else {
        const newSupersetId = crypto.randomUUID()
        handleUpdateItemField(activeIdStr, 'superset_id', newSupersetId)
        handleUpdateItemField(activeIdStr, 'execution_mode', modeFromDropZone)
      }
      return
    }

    // 3. Dropping onto a grouping zone (another item)
    if (overIdStr.startsWith('solo-drop-')) {
      const targetItemId = overIdStr.replace('solo-drop-', '')
      if (targetItemId !== activeIdStr) {
        handleGroupItems(activeIdStr, targetItemId)
      }
      return
    }

    // 4. Normal Reorder (within canvas)
    if (active.id !== over.id) {
      const oldIndex = items.findIndex((i) => isSameItemId(i.id, active.id))
      const newIndex = items.findIndex((i) => isSameItemId(i.id, over.id))
      if (oldIndex !== -1 && newIndex !== -1) {
        handleMoveItem(oldIndex, newIndex)
      }
    }
  }

  const handleSave = async () => {
    const savedId = await handleSaveProgram()
    if (savedId) {
      handleNavigateBack()
    }
  }

  if (isProgramLoading) {
    return <div className="p-8 text-center text-slate-500 font-medium font-bold">Chargement de l'éditeur...</div>
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-50">
      
      {/* HEADER TOP BAR */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm z-10 pt-safe lg:h-16 lg:px-6">
        <div className="flex items-center gap-2 min-w-0 flex-1 lg:gap-4">
          <button
            onClick={handleNavigateBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:h-10 lg:w-10"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="hidden text-xl font-bold text-slate-900 lg:block">Advanced Program Builder</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:hidden">
              Programme
            </p>
            <input
              value={program.name}
              onChange={e => handleProgramChange('name', e.target.value)}
              className="w-full max-w-full bg-transparent text-sm font-extrabold text-slate-900 outline-none placeholder:text-slate-300 lg:mt-0.5 lg:text-[11px] lg:font-bold lg:uppercase lg:tracking-widest lg:text-[#10b981] lg:placeholder:text-[#10b981]/50"
              placeholder="Nom du programme"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <Button
            variant="ghost"
            onClick={handleNavigateBack}
            className="hidden rounded-xl font-bold text-slate-500 hover:bg-slate-100 lg:inline-flex"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-xl bg-[#10b981] px-3 font-bold text-white shadow-md hover:bg-[#059669] lg:h-10 lg:px-6"
          >
            {isSaving ? (
              <span className="hidden lg:inline">Enregistrement...</span>
            ) : (
              <>
                <span className="lg:hidden">Sauver</span>
                <span className="hidden lg:inline">Enregistrer le programme</span>
              </>
            )}
            {isSaving && <span className="lg:hidden">…</span>}
          </Button>
        </div>
      </header>

      {/* MAIN SPLIT VIEW */}
      <DndContext sensors={sensors} collisionDetection={customCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          
          <div className="flex-1 bg-slate-50 relative overflow-y-auto custom-scrollbar touch-pan-y">
            <CanvasDropZone>
              {({ isOver: isCanvasDropOver, setNodeRef: setCanvasDropRef }) => (
                <div
                  ref={setCanvasDropRef}
                  className={`mx-auto max-w-4xl p-3 pb-32 space-y-3 rounded-[28px] transition-colors lg:p-10 lg:pb-40 lg:space-y-4 ${
                    isCanvasDropOver ? 'bg-[#10b981]/5' : ''
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                    <DroppableExecutionModeCard mode="Superset" subtitle="2+ exos enchaînés" />
                    <DroppableExecutionModeCard mode="Circuit" subtitle="enchaînement tours" />
                    <DroppableExecutionModeCard mode="AMRAP" subtitle="max reps au temps" />
                    <DroppableExecutionModeCard mode="EMOM" subtitle="chaque minute" />
                  </div>

                  {/* Mobile-only hint about long-press to reorder */}
                  {items.length > 1 && (
                    <div className="flex items-center gap-2 rounded-xl bg-slate-100/70 px-3 py-2 text-[11px] font-medium text-slate-600 lg:hidden">
                      <span className="text-base leading-none">💡</span>
                      <span>
                        <strong className="font-bold">Maintiens un exercice</strong> appuyé pour le déplacer
                        ou le grouper avec un autre.
                      </span>
                    </div>
                  )}

                  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.length === 0 ? (
                      <div className={`w-full flex items-center justify-center h-32 rounded-[24px] border-2 border-dashed text-slate-500 shadow-sm flex-col gap-2 transition-all ${isCanvasDropOver ? 'border-[#10b981]/50 bg-[#10b981]/10' : 'border-slate-300 bg-[#f4f7f9]/50'}`}>
                         <p className="text-sm font-bold text-slate-500">Votre programme est vide.</p>
                         <p className="text-xs font-medium text-slate-400">Glissez-déposez des exercices depuis la réserve !</p>
                      </div>
                    ) : (
                      (() => {
                        const rendered: React.ReactNode[] = [];
                        const processedSupersets = new Set<string>();

                        for (let i = 0; i < items.length; i++) {
                          const item = items[i];

                          if (item.is_section_header) {
                            rendered.push(
                              <SortableSeparator
                                key={item.id}
                                item={item}
                                onDelete={handleDeleteItem}
                                isFirst={i === 0}
                              />
                            );
                            continue;
                          }

                          if (item.superset_id && !processedSupersets.has(item.superset_id)) {
                            const groupItems = items.filter(it => it.superset_id === item.superset_id);
                            processedSupersets.add(item.superset_id);
                            const groupMode = normalizeExecutionMode(item.execution_mode);
                            const groupLabel = getAutoGroupLabel(groupMode, groupItems.length);
                            const primaryGroupItem = groupItems[0];

                            const getGroupIcon = () => {
                              if (groupMode === 'Superset') return <Link2 className="h-5 w-5 text-[#10b981]" strokeWidth={2.5} />
                              if (groupMode === 'Circuit') return <Repeat className="h-5 w-5 text-[#10b981]" strokeWidth={2.5} />
                              return <Clock className="h-5 w-5 text-[#10b981]" strokeWidth={2.5} />
                            }

                            rendered.push(
                              <div key={item.superset_id} className="mb-6 rounded-[24px] border-2 border-[#10b981]/20 bg-white transition-all shadow-sm overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-[#10b981]/10 bg-[#10b981]/[0.03]">
                                  <div className="flex items-center gap-3">
                                    {getGroupIcon()}
                                    <span className="text-[15px] font-extrabold text-slate-900">{groupLabel}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#10b981]/80">Mode</span>
                                      <Select
                                        value={groupMode}
                                        onValueChange={(val) => handleChangeExecutionMode(item.superset_id!, val)}
                                      >
                                        <SelectTrigger className="h-8 w-[110px] border-transparent bg-white shadow-sm text-[11px] font-extrabold text-slate-800 focus:ring-0">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-xl">
                                          <SelectItem value="Superset" className="text-xs font-bold">Classic</SelectItem>
                                          <SelectItem value="Circuit" className="text-xs font-bold">Circuit</SelectItem>
                                          <SelectItem value="AMRAP" className="text-xs font-bold">AMRAP</SelectItem>
                                          <SelectItem value="EMOM" className="text-xs font-bold">EMOM</SelectItem>
                                          <SelectItem value="Tabata" className="text-xs font-bold">Tabata</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {groupMode === 'AMRAP' && (
                                      <div className="flex items-center gap-2 ml-2">
                                        <div className="flex flex-col items-center">
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5">Total Time (Min)</span>
                                          <Input
                                            value={primaryGroupItem.amrap_duration ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'amrap_duration', parseNumeric(e.target.value))
                                            }
                                            className="h-8 w-16 text-center text-sm font-bold text-slate-800 bg-white border-transparent shadow-sm focus-visible:ring-1 focus-visible:ring-[#10b981]/30"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {groupMode === 'EMOM' && (
                                      <div className="flex items-center gap-2 ml-2">
                                        <div className="flex flex-col items-center">
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5">Minutes</span>
                                          <Input
                                            value={primaryGroupItem.amrap_duration ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'amrap_duration', parseNumeric(e.target.value))
                                            }
                                            className="h-8 w-16 text-center text-sm font-bold text-slate-800 bg-white border-transparent shadow-sm focus-visible:ring-1 focus-visible:ring-[#10b981]/30"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {groupMode === 'Tabata' && (
                                      <div className="flex items-center gap-3 ml-2">
                                        <div className="flex flex-col items-center">
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5">Work (Sec)</span>
                                          <Input
                                            value={primaryGroupItem.tabata_work ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'tabata_work', parseNumeric(e.target.value))
                                            }
                                            className="h-8 w-14 text-center text-sm font-bold text-slate-800 bg-[#10b981]/10 border-transparent focus-visible:ring-[#10b981]/30"
                                          />
                                        </div>
                                        <div className="flex flex-col items-center">
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5">Rest (Sec)</span>
                                          <Input
                                            value={primaryGroupItem.tabata_rest ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'tabata_rest', parseNumeric(e.target.value))
                                            }
                                            className="h-8 w-14 text-center text-sm font-bold text-slate-800 bg-[#10b981]/10 border-transparent focus-visible:ring-[#10b981]/30"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="px-5 pt-5 pb-2">
                                  <div className="space-y-0">
                                    {groupItems.map(gi => (
                                      <SortableSoloExercise
                                        key={gi.id}
                                        item={gi}
                                        onUpdate={handleUpdateItemField}
                                        onDelete={handleDeleteItem}
                                        isGrouped={true}
                                      />
                                    ))}
                                  </div>
                                  <div className="flex justify-center mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUngroupItem(item.superset_id!)}
                                      className="h-8 px-4 rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-[#10b981]/50 hover:bg-slate-50 hover:text-red-500 transition-colors"
                                    >
                                      Dissocier le groupe
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                            continue;
                          }

                          if (!item.superset_id) {
                            rendered.push(
                              <SortableSoloExercise 
                                key={item.id} 
                                item={item} 
                                onUpdate={handleUpdateItemField} 
                                onDelete={handleDeleteItem} 
                              />
                            );
                          }
                        }
                        return rendered;
                      })()
                    )}
                  </SortableContext>
                </div>
              )}
            </CanvasDropZone>
          </div>

        {/* RIGHT ZONE: LA RESERVE (Library) — desktop only */}
        <div className="hidden w-[360px] shrink-0 border-l border-slate-200 bg-[#fbfbfb] z-0 relative shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)] lg:flex lg:w-[400px] lg:flex-col">
          <div className="p-5 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <h2 className="text-lg font-extrabold text-slate-900 flex justify-between items-center mb-4">
              La Réserve
              <div className="flex items-center justify-center bg-slate-100 h-6 w-6 rounded-full">
                <Dumbbell className="h-3.5 w-3.5 text-slate-500" />
              </div>
            </h2>
            
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher des exercices..." 
                className="h-10 rounded-xl bg-white pl-9 shadow-sm border-slate-200/80 focus-visible:ring-[#10b981]/20 font-medium" 
              />
            </div>
            
            {/* Type filters (Cardio/Renforcement/Étirement/Mobilité) */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1.5 mb-1.5">
              {(['TOUT', 'Renforcement', 'Cardio', 'Étirement', 'Mobilité'] as const).map((label) => (
                <Badge
                  key={label}
                  onClick={() => setTypeFilter(label)}
                  variant={typeFilter === label ? 'secondary' : 'outline'}
                  className={`${typeFilter === label ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'} font-bold rounded-lg px-3 py-1 text-[10px] cursor-pointer whitespace-nowrap`}
                >
                  {label === 'TOUT' ? 'TOUS TYPES' : label.toUpperCase()}
                </Badge>
              ))}
            </div>

            {/* Muscle filters (legacy quick chips) */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
               <Badge
                  onClick={() => setMuscleFilter('TOUT')}
                  variant={muscleFilter === 'TOUT' ? 'secondary' : 'outline'}
                  className={`${muscleFilter === 'TOUT' ? 'bg-[#10b981] text-white shadow-sm hover:bg-[#059669]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} font-bold rounded-lg px-3 py-1 text-[10px] cursor-pointer`}
                >ZONES</Badge>
                <Badge 
                  onClick={() => setMuscleFilter('PECTORAUX')}
                  variant={muscleFilter === 'PECTORAUX' ? 'secondary' : 'outline'} 
                  className={`${muscleFilter === 'PECTORAUX' ? 'bg-[#10b981] text-white shadow-sm hover:bg-[#059669]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} font-bold rounded-lg px-3 py-1 text-[10px] cursor-pointer`}
                >PECTORAUX</Badge>
                <Badge 
                  onClick={() => setMuscleFilter('DOS')}
                  variant={muscleFilter === 'DOS' ? 'secondary' : 'outline'} 
                  className={`${muscleFilter === 'DOS' ? 'bg-[#10b981] text-white shadow-sm hover:bg-[#059669]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} font-bold rounded-lg px-3 py-1 text-[10px] cursor-pointer`}
                >DOS</Badge>
                <Badge 
                  onClick={() => setMuscleFilter('JAMBES')}
                  variant={muscleFilter === 'JAMBES' ? 'secondary' : 'outline'} 
                  className={`${muscleFilter === 'JAMBES' ? 'bg-[#10b981] text-white shadow-sm hover:bg-[#059669]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} font-bold rounded-lg px-3 py-1 text-[10px] cursor-pointer`}
                >JAMBES</Badge>
            </div>
          </div>
          
          <div className="flex-1 px-4 py-4 overflow-y-auto touch-pan-y">
            <div className="space-y-4 pb-20">
              
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">Séparateurs</h4>
              <div className="grid grid-cols-2 gap-2 mb-6 border-b border-slate-100 pb-6">
                <DraggableSeparatorBtn name="Échauffement" icon={true} />
                <DraggableSeparatorBtn name="Corps de séance" icon={true} />
                <DraggableSeparatorBtn name="Retour au calme" icon={true} />
                <DraggableSeparatorBtn name="Étirement" icon={true} />
                <DraggableSeparatorBtn name="Mobilité" icon={true} />
              </div>

              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">Exercices</h4>
              
              {isLibraryLoading ? (
                 <div className="text-center text-xs font-medium text-slate-400 p-4">Chargement...</div>
              ) : filteredLibrary.length === 0 ? (
                 <div className="text-center text-xs font-medium text-slate-400 p-4 border border-dashed rounded-xl bg-blend-lighten">Aucun exercice</div>
              ) : (
                filteredLibrary.map((exo) => (
                  <DraggableLibraryCard key={exo.id} exo={exo} />
                ))
              )}

            </div>
          </div>
        </div>
      </div>

      {/* MOBILE ONLY — Floating Action Button to open library sheet
          - z-[60] to stay above sortable exercise cards (z-50)
          - Hidden when the sheet is open (avoids overlapping the sheet content)
          - Positioned above the CoachBottomNav (64px height + safe-area-inset-bottom)
      */}
      {!isLibraryOpenMobile && (
        <button
          type="button"
          onClick={() => setIsLibraryOpenMobile(true)}
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          className="fixed right-4 z-[60] flex h-14 items-center gap-2 rounded-full bg-[#10b981] px-5 font-extrabold text-white shadow-2xl shadow-emerald-500/40 active:scale-95 transition-transform lg:hidden"
          aria-label="Ouvrir la bibliothèque"
        >
          <Library className="h-5 w-5" />
          <span className="text-sm">Ajouter</span>
        </button>
      )}

      {/* MOBILE ONLY — Library Modal Sheet (polished) */}
      <Sheet open={isLibraryOpenMobile} onOpenChange={setIsLibraryOpenMobile}>
        <SheetContent
          side="bottom"
          className="data-[side=bottom]:h-[78dvh] data-[side=bottom]:max-h-[78dvh] flex flex-col overflow-hidden rounded-t-[28px] border-none bg-white p-0 shadow-2xl lg:hidden"
        >
          <SheetTitle className="sr-only">Bibliothèque d'exercices</SheetTitle>

          {/* Drag handle */}
          <div className="flex shrink-0 justify-center pt-2.5 pb-1">
            <span className="h-1 w-10 rounded-full bg-slate-300" aria-hidden />
          </div>

          {/* Hero header (gradient) — title + sort + close */}
          <div className="shrink-0 px-4 pt-1 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b981]/10">
                  <Library className="h-4 w-4 text-[#10b981]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold leading-tight text-slate-900">
                    La Réserve
                  </h2>
                  <p className="text-[10px] font-medium text-slate-500">
                    {sortedLibrary.length} exercice{sortedLibrary.length > 1 ? 's' : ''} disponible{sortedLibrary.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Sort menu (Select) */}
                <Select
                  value={librarySort}
                  onValueChange={(v) => setLibrarySort(v as typeof librarySort)}
                >
                  <SelectTrigger className="h-9 gap-1 rounded-full border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 focus:ring-0 [&>svg:last-child]:opacity-50">
                    <SortIcon sort={librarySort} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className="rounded-xl">
                    <SelectItem value="name_asc">
                      <span className="flex items-center gap-2">
                        <ArrowUpAZ className="h-3.5 w-3.5" /> Nom (A–Z)
                      </span>
                    </SelectItem>
                    <SelectItem value="name_desc">
                      <span className="flex items-center gap-2">
                        <ArrowDownAZ className="h-3.5 w-3.5" /> Nom (Z–A)
                      </span>
                    </SelectItem>
                    <SelectItem value="type">
                      <span className="flex items-center gap-2">
                        <LayersIcon className="h-3.5 w-3.5" /> Par type
                      </span>
                    </SelectItem>
                    <SelectItem value="body">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" /> Par zone
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <button
                  onClick={() => setIsLibraryOpenMobile(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-transform"
                  aria-label="Fermer la bibliothèque"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search + filters (sticky-ish via padding) */}
          <div className="shrink-0 space-y-2.5 border-b border-slate-100 bg-white px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher un exercice…"
                className="h-11 rounded-2xl bg-slate-50 pl-9 border-transparent focus-visible:bg-white focus-visible:border-[#10b981]/30 focus-visible:ring-[#10b981]/15 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Type filter chips */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
              {(['TOUT', 'Renforcement', 'Cardio', 'Étirement', 'Mobilité'] as const).map((label) => {
                const active = typeFilter === label
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setTypeFilter(label)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 active:scale-95'
                    }`}
                  >
                    {label === 'TOUT' ? 'TOUS' : label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content scrollable area (slider) */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-8 custom-scrollbar">

            {/* Separators row — tap to add */}
            <details className="group mb-4 rounded-2xl bg-slate-50 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                  Séparateurs de séance
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                {(['Échauffement', 'Corps de séance', 'Retour au calme', 'Étirement', 'Mobilité'] as const).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddSeparatorFromMobileSheet(name)}
                    className="flex items-center justify-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-600 active:scale-[0.97] active:bg-[#10b981]/5 active:border-[#10b981]/40 active:text-[#10b981] transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
            </details>

            {/* Exercises list */}
            <div className="mb-2 flex items-center justify-between px-1">
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Exercices
              </h4>
              {hasActiveLibraryFilter(searchQuery, typeFilter, muscleFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setTypeFilter('TOUT')
                    setMuscleFilter('TOUT')
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="space-y-2">
              {isLibraryLoading ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-medium text-slate-400">
                  Chargement…
                </div>
              ) : sortedLibrary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-700">Aucun exercice</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Modifie ta recherche ou tes filtres.
                  </p>
                </div>
              ) : (
                sortedLibrary.map((exo) => {
                  const justAdded = recentlyAddedExoId === String(exo.id)
                  return (
                    <button
                      key={exo.id}
                      type="button"
                      onClick={() => handleAddExoFromMobileSheet(exo)}
                      className={`group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-200 ${
                        justAdded
                          ? 'bg-[#10b981]/10 border-2 border-[#10b981] scale-[0.99]'
                          : 'bg-white border border-slate-200 active:scale-[0.99] active:border-[#10b981]/40 active:bg-[#10b981]/5'
                      }`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 overflow-hidden border border-slate-200/50">
                        {exo.photo_url ? (
                          <img src={exo.photo_url} alt={exo.name} className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`truncate text-sm font-bold transition-colors ${
                          justAdded ? 'text-[#10b981]' : 'text-slate-900 group-active:text-[#10b981]'
                        }`}>
                          {exo.name}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-medium text-slate-500">
                          {exo.type && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                              {exo.type}
                            </span>
                          )}
                          <span className="truncate">{exo.body_part || 'Toutes zones'}</span>
                        </p>
                      </div>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                        justAdded
                          ? 'bg-[#10b981] text-white scale-110'
                          : 'bg-[#10b981]/10 text-[#10b981] group-active:bg-[#10b981] group-active:text-white'
                      }`}>
                        {justAdded ? (
                          <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
                        ) : (
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        )}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DragOverlay dropAnimation={null}>
        {activeDragId && activeDragData ? (
          <div className="rounded-2xl border-2 border-[#10b981] bg-white p-4 shadow-xl opacity-90 scale-105 pointer-events-none">
             <div className="flex gap-4">
               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-[#10b981]/50">
                   <Dumbbell className="h-5 w-5 text-[#10b981]" />
               </div>
               <div>
                  <h3 className="text-sm font-bold text-[#10b981]">{activeDragData.name || activeDragData.exercise?.name}</h3>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#10b981]/60">Glisser pour ajouter</p>
               </div>
             </div>
          </div>
        ) : null}
      </DragOverlay>

      </DndContext>
    </div>
  )
}
