import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CoachHeader } from '@/components/coach/CoachHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Search, Plus, Dumbbell, MoreHorizontal, PlayCircle, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ExerciseModal } from '@/components/coach/ExerciseModal'
import { useExerciseLibrary } from '@/hooks/useExerciseLibrary'
import type { Exercise } from '@/hooks/useExerciseLibrary'
import { useCoachPrograms } from '@/hooks/useCoachPrograms'

export default function ProgramsPage() {
  const navigate = useNavigate()
  const { exercises, loading: libraryLoading, handleSaveExercise, handleDeleteExercise } = useExerciseLibrary()
  const { programs, loading: programsLoading } = useCoachPrograms(true)
  
  const [activeTab, setActiveTab] = useState('programs')
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false)
  const [itemToEdit, setItemToEdit] = useState<Exercise | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('TOUT')



  const filteredExercises = exercises.filter((exo) => {
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

  // Open modal for new
  const handleOpenNew = () => {
    setItemToEdit(null)
    setIsExerciseModalOpen(true)
  }

  // Open modal for edit
  const handleOpenEdit = (exo: Exercise) => {
    setItemToEdit(exo)
    setIsExerciseModalOpen(true)
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 relative">
      <CoachHeader
        title="Gestion des Programmes"
        subtitle="Créez des modèles et gérez votre bibliothèque d'exercices."
      />

      <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-8 custom-scrollbar pb-24 lg:pb-8">
        <div className="mx-auto max-w-7xl space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/60 sm:w-[480px]">
                <TabsTrigger value="programs" className="rounded-xl text-sm font-bold data-[state=active]:bg-[#10b981]/10 data-[state=active]:text-[#10b981] data-[state=active]:shadow-none">Mes Programmes</TabsTrigger>
                <TabsTrigger value="library" className="rounded-xl text-sm font-bold data-[state=active]:bg-[#10b981]/10 data-[state=active]:text-[#10b981] data-[state=active]:shadow-none">Bibliothèque d'Exercices</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === 'programs' ? (
              <Button 
                onClick={() => navigate('/coach/programs/builder')}
                className="bg-[#10b981] font-bold text-white shadow-lg hover:bg-[#059669] rounded-xl gap-2 h-11 px-6"
              >
                <Plus className="h-5 w-5" /> Nouveau Programme
              </Button>
            ) : (
              <Button 
                onClick={handleOpenNew}
                className="bg-[#10b981] font-bold text-white shadow-lg hover:bg-[#059669] rounded-xl gap-2 h-11 px-6"
              >
                <Plus className="h-5 w-5" /> Nouvel Exercice
              </Button>
            )}
          </div>

          {/* TAB 1 : MES PROGRAMMES */}
          {activeTab === 'programs' && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {programsLoading ? (
                  <div className="text-slate-500 font-medium text-center p-8 w-full col-span-full">Chargement de vos programmes...</div>
                ) : programs.length === 0 ? (
                  <div className="text-slate-500 font-medium text-center p-8 w-full col-span-full border border-dashed rounded-xl bg-white">Vous n'avez pas encore de programme. Utilisez le constructeur pour commencer !</div>
                ) : (
                  programs.map(prog => (
                    <div 
                      key={prog.id} 
                      onClick={() => navigate(`/coach/programs/builder/${prog.id}`)} 
                      className="group cursor-pointer rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-md hover:ring-[#10b981]/30 overflow-hidden"
                    >
                      <div className="h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                        <Dumbbell className="h-10 w-10 text-slate-300" />
                        <div className="absolute top-3 right-3">
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="bg-white/90 text-slate-700 font-bold border-none shadow-sm backdrop-blur-sm">
                              {prog.environment}
                            </Badge>
                            {prog.specific_client_id != null && (
                              <Badge variant="secondary" className="bg-[#10b981]/90 text-white font-bold border-none shadow-sm backdrop-blur-sm">
                                Sur-mesure client
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-slate-900 text-lg group-hover:text-[#10b981] transition-colors line-clamp-2">{prog.name}</h3>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              // More options logic here
                            }}
                            className="text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </div>
                        
                        <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <div className="flex items-center gap-1.5"><CalendarIcon className="h-4 w-4" /> Programme</div>
                          <div className="w-1 h-1 rounded-full bg-slate-300" />
                          <div className="flex items-center gap-1.5"><PlayCircle className="h-4 w-4" /> {prog.specific_client_id != null ? 'Personnalisé' : 'Modèle'}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2 : BIBLIOTHÈQUE D'EXERCICES */}
          {activeTab === 'library' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Rechercher un exercice..." 
                    className="h-11 rounded-xl bg-white pl-10 border-slate-200/80 shadow-sm focus-visible:ring-[#10b981]/20 font-medium" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                  <Badge 
                    onClick={() => setMuscleFilter('TOUT')}
                    variant={muscleFilter === 'TOUT' ? 'secondary' : 'outline'} 
                    className={`${muscleFilter === 'TOUT' ? 'bg-[#10b981]/15 text-[#10b981]' : 'text-slate-600 hover:bg-slate-50'} font-bold px-4 py-1.5 text-xs rounded-xl cursor-pointer`}
                  >TOUT</Badge>
                  <Badge 
                    onClick={() => setMuscleFilter('PECTORAUX')}
                    variant={muscleFilter === 'PECTORAUX' ? 'secondary' : 'outline'} 
                    className={`${muscleFilter === 'PECTORAUX' ? 'bg-[#10b981]/15 text-[#10b981]' : 'text-slate-600 hover:bg-slate-50'} font-bold px-4 py-1.5 text-xs rounded-xl cursor-pointer`}
                  >PECTORAUX</Badge>
                  <Badge 
                    onClick={() => setMuscleFilter('DOS')}
                    variant={muscleFilter === 'DOS' ? 'secondary' : 'outline'} 
                    className={`${muscleFilter === 'DOS' ? 'bg-[#10b981]/15 text-[#10b981]' : 'text-slate-600 hover:bg-slate-50'} font-bold px-4 py-1.5 text-xs rounded-xl cursor-pointer`}
                  >DOS</Badge>
                  <Badge 
                    onClick={() => setMuscleFilter('JAMBES')}
                    variant={muscleFilter === 'JAMBES' ? 'secondary' : 'outline'} 
                    className={`${muscleFilter === 'JAMBES' ? 'bg-[#10b981]/15 text-[#10b981]' : 'text-slate-600 hover:bg-slate-50'} font-bold px-4 py-1.5 text-xs rounded-xl cursor-pointer`}
                  >JAMBES</Badge>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0 sm:ml-2">
                    <Settings2 className="h-4 w-4 text-slate-600" />
                  </Button>
                </div>
              </div>

              {libraryLoading ? (
                <div className="text-slate-500 font-medium text-center p-8 w-full col-span-full">Chargement de vos exercices...</div>
              ) : filteredExercises.length === 0 ? (
                <div className="text-slate-500 font-medium text-center p-8 w-full col-span-full border border-dashed rounded-xl bg-white">Aucun exercice trouvé.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredExercises.map(exo => (
                    <Card key={exo.id} onClick={() => handleOpenEdit(exo)} className="group cursor-pointer border-none bg-white p-4 shadow-sm ring-1 ring-slate-200/60 transition-hover hover:shadow-md hover:ring-[#10b981]/30 rounded-2xl flex items-center gap-4">
                       <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/50 overflow-hidden relative">
                          {exo.photo_url ? (
                            <img src={exo.photo_url} alt={exo.name} className="w-full h-full object-cover" />
                          ) : (
                            <Dumbbell className="h-6 w-6 text-slate-400" />
                          )}
                       </div>
                       <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 text-[15px] truncate group-hover:text-[#10b981] transition-colors">{exo.name}</h4>
                          <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{exo.body_part || 'Toutes zones'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {exo.charge_type && <Badge variant="secondary" className="bg-slate-100 text-[9px] uppercase tracking-wider font-bold text-slate-500 rounded-md py-0">{exo.charge_type}</Badge>}
                            {(exo.sets || exo.reps) && <Badge variant="secondary" className="bg-slate-100 text-[9px] uppercase tracking-wider font-bold text-slate-500 rounded-md py-0">{exo.sets && exo.reps ? `${exo.sets}x${exo.reps}` : (exo.sets || exo.reps)}</Badge>}
                          </div>
                       </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <ExerciseModal 
        isOpen={isExerciseModalOpen} 
        onOpenChange={setIsExerciseModalOpen} 
        itemToEdit={itemToEdit}
        onSave={async (data: Partial<Exercise>) => {
          const success = await handleSaveExercise(data, itemToEdit)
          if (success) setIsExerciseModalOpen(false)
        }}
        onDelete={async (item: Exercise) => {
          const success = await handleDeleteExercise(item)
          if (success) setIsExerciseModalOpen(false)
        }}
      />
    </div>
  )
}

function CalendarIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  )
}
