const fs = require('fs');
const content = fs.readFileSync('src/pages/coach/ProgramBuilder.tsx', 'utf8');
const start = content.indexOf('function SortableSoloExercise');
const end = content.indexOf('function SortableSeparator') - 1;
const before = content.substring(0, start);
const after = content.substring(end);

const newComponent = \unction SortableSoloExercise({ item, onUpdate, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const [isExpanded, setIsExpanded] = useState(false)
  const numSets = Number(item.sets) || 0

  const handleSetDetailChange = (index, field, value) => {
    const currentDetails = Array.isArray(item.set_details) ? [...item.set_details] : []
    while (currentDetails.length < numSets) {
      currentDetails.push({})
    }
    currentDetails[index] = { ...currentDetails[index], [field]: value }
    onUpdate(item.id, 'set_details', currentDetails)
  }

  // Droppable zone over the whole card for grouping
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: \\\solo-drop-\\\\ })

  return (
    <div ref={setDropRef} className="relative">
      {/* We need the inner to be sortable, the outer to be droppable */}
      <div
        ref={setNodeRef}
        style={style}
        className={\\\ounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition-all mb-4 relative z-50 \\\\}
      >
       <div className="flex items-center justify-between flex-wrap gap-4">
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
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30"
                       placeholder={String(item.reps || '')}
                     />
                   </div>
                   <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-1.5 border border-slate-100 min-w-[100px]">
                     <span className="text-[10px] uppercase font-bold text-slate-400 w-12 sm:w-16 text-center">Charge</span>
                     <Input 
                       value={detail.charge !== undefined ? detail.charge : (item.charge || '')} 
                       onChange={e => handleSetDetailChange(index, 'charge', e.target.value)}
                       className="h-8 flex-1 text-center text-sm font-semibold border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#10b981]/30"
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
\;

fs.writeFileSync('src/pages/coach/ProgramBuilder.tsx', before + newComponent + after);
