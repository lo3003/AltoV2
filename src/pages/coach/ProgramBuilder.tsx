import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, Search, Dumbbell, Plus,
  GripVertical, Trash2, ChevronDown, ChevronUp, Link2, Repeat, Clock
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
      {/* We need the inner to be sortable, the outer to be droppable */}
      <div
        ref={setNodeRef}
        style={style}
        className={`rounded-[24px] bg-white p-4 shadow-sm transition-all flex flex-col relative z-50 ${isOver ? 'ring-2 ring-[#10b981]/50 bg-[#10b981]/5' : ''} ${isGrouped ? 'border border-slate-100 mb-2' : 'border border-slate-200 mb-4'}`}
      >
       <div className="flex items-center justify-between gap-4 flex-wrap">
         <div className="flex items-center gap-4">
            <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing p-1">
              <GripVertical className="h-5 w-5" />
            </button>
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

         <div className="flex items-center gap-4 sm:ml-auto">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mode</span>
              <Select value={item.effort_type || 'range'} onValueChange={(val) => onUpdate(item.id, 'effort_type', val)}>
                <SelectTrigger className="h-8 w-28 rounded-lg bg-slate-50 border-none text-xs font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="range">Plage</SelectItem>
                  <SelectItem value="fixed">Fixe</SelectItem>
                  <SelectItem value="time">Temps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Sets</p>
              <Input value={item.sets || ''} onChange={e => {
                onUpdate(item.id, 'sets', e.target.value)
              }} className="h-9 w-16 text-center text-sm font-bold rounded-lg border-slate-200" />
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Reps</p>
              <Input value={item.reps || ''} onChange={e => onUpdate(item.id, 'reps', e.target.value)} className="h-9 w-20 text-center text-sm font-bold rounded-lg border-slate-200" />
            </div>
            <div className="text-center">
               <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Charge({item.charge_type||'kg'})</p>
               <Input value={item.charge || ''} onChange={e => onUpdate(item.id, 'charge', e.target.value)} className="h-9 w-20 text-center text-sm font-bold rounded-lg border-slate-200" />
            </div>
            <div className="text-center">
               <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Rest</p>
               <Input value={item.rest_time || ''} onChange={e => onUpdate(item.id, 'rest_time', e.target.value)} className="h-9 w-20 text-center text-sm font-bold rounded-lg border-slate-200" />
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
                   <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-1.5 border border-slate-100 min-w-[100px]">
                     <span className="text-[10px] uppercase font-bold text-slate-400 w-10 sm:w-12 text-center">Reps</span>
                     <Input 
                       value={detail.reps !== undefined ? detail.reps : (item.reps || '')} 
                       onChange={e => handleSetDetailChange(index, 'reps', e.target.value)}
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30 bg-transparent"
                       placeholder={String(item.reps || '')}
                     />
                   </div>
                   <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-1.5 border border-slate-100 min-w-[100px]">
                     <span className="text-[10px] uppercase font-bold text-slate-400 w-12 sm:w-16 text-center">Charge</span>
                     <Input 
                       value={detail.charge !== undefined ? detail.charge : (item.charge || '')} 
                       onChange={e => handleSetDetailChange(index, 'charge', e.target.value)}
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30 bg-transparent"
                       placeholder={String(item.charge || '')}
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

function SortableSeparator({ item, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 mb-4 mt-8">
       <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing p-1">
          <GripVertical className="h-5 w-5" />
       </button>
       <div className="flex-1 h-px bg-slate-200"></div>
       <Badge variant="outline" className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 bg-white uppercase tracking-widest shadow-sm">
         {item.name}
       </Badge>
       <div className="flex-1 h-px bg-slate-200"></div>
       <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-all p-2">
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
  const [muscleFilter, setMuscleFilter] = useState('TOUT')
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

  const filteredLibrary = libraryExercises.filter((exo) => {
    const matchSearch = exo.name.toLowerCase().includes(searchQuery.toLowerCase())
    let matchMuscle = true
    if (muscleFilter !== 'TOUT') {
      const bp = (exo.body_part || '').toLowerCase()
      if (muscleFilter === 'PECTORAUX' && !bp.includes('pect') && !bp.includes('chest')) matchMuscle = false
      if (muscleFilter === 'DOS' && !bp.includes('dos') && !bp.includes('back')) matchMuscle = false
      if (muscleFilter === 'JAMBES' && !bp.includes('jambe') && !bp.includes('leg') && !bp.includes('fess')) matchMuscle = false
    }
    return matchSearch && matchMuscle
  })

  // DND Handlers
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
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

        // If dropping directly onto an item card, it groups automatically
        if (overIdStr.startsWith('solo-drop-')) {
          const targetItemId = overIdStr.replace('solo-drop-', '')
          const targetItem = items.find((it) => isSameItemId(it.id, targetItemId))
          const targetIndex = items.findIndex((it) => isSameItemId(it.id, targetItemId))

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
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm z-10 transition-all">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleNavigateBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Advanced Program Builder</h1>
            <input 
              value={program.name} 
              onChange={e => handleProgramChange('name', e.target.value)}
              className="mt-0.5 bg-transparent text-[11px] font-bold uppercase tracking-widest text-[#10b981] outline-none placeholder:text-[#10b981]/50 w-64"
              placeholder="NOM DU PROGRAMME"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleNavigateBack} className="rounded-xl font-bold text-slate-500 hover:bg-slate-100">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl bg-[#10b981] px-6 font-bold text-white shadow-md hover:bg-[#059669]">
            {isSaving ? 'Enregistrement...' : 'Enregistrer le programme'}
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
                  className={`mx-auto max-w-4xl p-6 lg:p-10 pb-40 space-y-4 rounded-[28px] transition-colors ${
                    isCanvasDropOver ? 'bg-[#10b981]/5' : ''
                  }`}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DroppableExecutionModeCard mode="Superset" subtitle="2+ exos enchaînés" />
                    <DroppableExecutionModeCard mode="Circuit" subtitle="enchaînement tours" />
                    <DroppableExecutionModeCard mode="AMRAP" subtitle="max reps au temps" />
                    <DroppableExecutionModeCard mode="EMOM" subtitle="chaque minute" />
                  </div>

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
                            rendered.push(<SortableSeparator key={item.id} item={item} onDelete={handleDeleteItem} />);
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

        {/* RIGHT ZONE: LA RESERVE (Library) */}
        <div className="w-[360px] lg:w-[400px] shrink-0 border-l border-slate-200 bg-[#fbfbfb] flex flex-col z-0 relative shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
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
            
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
               <Badge 
                  onClick={() => setMuscleFilter('TOUT')}
                  variant={muscleFilter === 'TOUT' ? 'secondary' : 'outline'} 
                  className={`${muscleFilter === 'TOUT' ? 'bg-[#10b981] text-white shadow-sm hover:bg-[#059669]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} font-bold rounded-lg px-3 py-1 text-[10px] cursor-pointer`}
                >TOUT</Badge>
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
              
              <div className="grid grid-cols-2 gap-2 mb-6 border-b border-slate-100 pb-6">
                <DraggableSeparatorBtn name="Échauffement" icon={true} />
                <DraggableSeparatorBtn name="Corps de séance" icon={true} />
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
