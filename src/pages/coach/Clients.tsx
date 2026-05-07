import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCoachClients, type ClientFormInput, type CoachClient } from '@/hooks/useCoachClients'
import { useCoachCalendar } from '@/hooks/useCoachCalendar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, MessageSquare, Calendar as CalendarIcon, Plus, Pencil } from 'lucide-react'
import { CoachHeader } from '@/components/coach/CoachHeader'
import { AddClientDialog } from '@/components/coach/AddClientDialog'
import { EditClientDialog } from '@/components/coach/EditClientDialog'
import { BroadcastModal } from '@/components/coach/BroadcastModal'
import { toast } from 'sonner'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatSessionStatus = (status?: string | null) => {
  const normalized = String(status || 'planned').toLowerCase()
  if (normalized === 'completed') return 'Complétée'
  if (normalized === 'cancelled') return 'Annulée'
  if (normalized === 'skipped') return 'Non faite'
  return 'Planifiée'
}

const getSessionStatusClassName = (status?: string | null) => {
  const normalized = String(status || 'planned').toLowerCase()
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700 border-none'
  if (normalized === 'cancelled') return 'bg-rose-100 text-rose-700 border-none'
  if (normalized === 'skipped') return 'bg-amber-100 text-amber-700 border-none'
  return 'bg-blue-100 text-blue-700 border-none'
}

const formatDisplayDate = (date?: Date) => {
  if (!date) return ''
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { clients, loading, saving, error, addClient, updateClient } = useCoachClients()
  const [activeTab, setActiveTab] = useState('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false)
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false)
  const [isEditClientDialogOpen, setIsEditClientDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<CoachClient | null>(null)
  const [date, setDate] = useState<Date>(new Date())
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date())

  const {
    sessionsByDate,
    sessionCountByDate,
    daysWithSessions,
    loading: calendarLoading,
    tableReady: calendarTableReady,
    error: calendarError,
  } = useCoachCalendar(user?.id || null)

  const selectedDateKey = useMemo(() => toDateKey(date), [date])

  const selectedDateSessions = useMemo(() => {
    return sessionsByDate[selectedDateKey] || []
  }, [selectedDateKey, sessionsByDate])

  const selectedMonthSessionCount = useMemo(() => {
    const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`

    return Object.entries(sessionCountByDate).reduce((total, [dayKey, count]) => {
      if (dayKey.startsWith(monthKey)) return total + count
      return total
    }, 0)
  }, [sessionCountByDate, visibleMonth])

  useEffect(() => {
    if (searchParams.get('openAdd') !== '1') return

    setIsAddClientDialogOpen(true)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('openAdd')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])



  const filteredClients = clients.filter(c => 
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const DayButtonWithCount = (props: ComponentProps<typeof CalendarDayButton>) => {
    const dayKey = toDateKey(props.day.date)
    const count = sessionCountByDate[dayKey] || 0

    return (
      <div className="relative">
        <CalendarDayButton {...props} />
        {count > 0 && (
          <span className="pointer-events-none absolute right-0 top-0 inline-flex h-5 min-w-5 translate-x-1 -translate-y-1 items-center justify-center rounded-full bg-[#10b981] px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>
    )
  }

  const handleAddClient = async (payload: ClientFormInput) => {
    try {
      const { clientCode } = await addClient(payload)
      toast.success(`Client ajouté ! Son code d'accès est : ${clientCode}`)
      setIsAddClientDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du client.'
      toast.error(message)
    }
  }

  const openEditDialog = (client: CoachClient) => {
    setEditingClient(client)
    setIsEditClientDialogOpen(true)
  }

  const handleEditClient = async (clientId: string, payload: ClientFormInput) => {
    try {
      const updatedClient = await updateClient(clientId, payload)
      toast.success(`Informations de "${updatedClient.full_name || updatedClient.email}" mises à jour.`)
      setIsEditClientDialogOpen(false)
      setEditingClient(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du client.'
      toast.error(message)
    }
  }

  const handleBroadcastSend = async (receiverIds: string[], content: string) => {
    if (!user?.id) throw new Error('Coach non connecté.')

    const payload = receiverIds.map((receiverId) => ({
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      is_read: false,
    }))

    const { error } = await supabase
      .from('messages')
      .insert(payload)

    if (error) throw error
    return receiverIds.length
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement des clients...</div>
  }

  return (
    <div className="flex flex-col bg-slate-50 relative">
      <CoachHeader
        title="Mes Clients"
        subtitle="Vues liste et calendrier global."
      />

      <div className="px-4 py-4 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-7xl space-y-5 lg:space-y-6">

          {/* Header Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="list" className="text-xs sm:text-sm">Liste</TabsTrigger>
                <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendrier</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === 'list' && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un client..."
                    className="h-10 w-full rounded-xl border-none bg-white pl-10 pr-4 text-sm shadow-sm ring-1 ring-slate-200/60 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button
                  onClick={() => setIsAddClientDialogOpen(true)}
                  className="h-10 shrink-0 gap-2 rounded-xl bg-[#10b981] font-semibold text-white shadow-sm hover:bg-[#059669]"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Ajouter un client</span>
                  <span className="sm:hidden">Ajouter</span>
                </Button>
              </div>
            )}
          </div>

          {/* LIST TAB */}
          {activeTab === 'list' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
              {filteredClients.map((client) => {
                const initials = client.full_name
                  ? client.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                  : 'CL'
                  
                return (
                  <Card 
                    key={client.id}
                    onClick={() => navigate(`/coach/clients/${client.id}`)}
                    className="group cursor-pointer border-none bg-white shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-md hover:ring-primary/30"
                  >
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <Avatar className="h-12 w-12 border border-slate-100 ring-4 ring-slate-50 group-hover:ring-primary/10 transition-all">
                          <AvatarImage src={client.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/5 font-bold text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-[#10b981]/15 text-[#10b981] font-bold text-[10px] tracking-wider border-none">
                            Actif
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              openEditDialog(client)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier les infos</span>
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {client.full_name || client.email}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {client.main_goal || 'Objectif non défini'}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Code: {client.client_code}
                        </p>
                      </div>
                      
                      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Poids</p>
                          <p className="text-sm font-semibold text-slate-800">{client.initial_weight_kg ? `${client.initial_weight_kg} kg` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Séances / sem</p>
                          <p className="text-sm font-semibold text-slate-800">{client.training_frequency || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              
              {filteredClients.length === 0 && (
                <div className="col-span-full rounded-2xl border-2 border-dashed border-primary/30 bg-white py-12 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-base font-bold text-slate-700">
                    {clients.length === 0 ? 'Aucun client pour le moment' : 'Aucun client ne correspond à ta recherche'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {clients.length === 0
                      ? 'Crée ta première fiche client pour commencer.'
                      : 'Essaie un autre nom ou code client.'}
                  </p>
                  {clients.length === 0 && (
                    <Button
                      onClick={() => setIsAddClientDialogOpen(true)}
                      className="mt-4 h-11 gap-2 rounded-xl bg-primary font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter mon premier client
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CALENDAR TAB */}
          {activeTab === 'calendar' && (
            <div className="grid items-start gap-6 pb-20 lg:grid-cols-[minmax(620px,1.25fr)_1fr] lg:gap-8">
              <Card className="mx-auto w-full rounded-3xl border-none bg-white p-5 shadow-sm ring-1 ring-slate-200/60 lg:mx-0 lg:p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Calendrier coach</p>
                    <h3 className="text-xl font-black text-slate-900">Vue mensuelle globale</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none font-bold">
                      {selectedMonthSessionCount} séance(s) ce mois
                    </Badge>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                      {selectedDateSessions.length} ce jour
                    </Badge>
                  </div>
                </div>

                <Calendar
                  mode="single"
                  selected={date}
                  month={visibleMonth}
                  onSelect={(nextDate) => {
                    if (nextDate) {
                      setDate(nextDate)
                      setVisibleMonth(nextDate)
                    }
                  }}
                  onMonthChange={setVisibleMonth}
                  modifiers={{
                    scheduled: daysWithSessions,
                  }}
                  modifiersClassNames={{
                    scheduled: 'bg-emerald-50 text-emerald-700 font-bold',
                  }}
                  components={{
                    DayButton: DayButtonWithCount,
                  }}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-2 [--cell-size:3.2rem] sm:[--cell-size:3.5rem] lg:[--cell-size:3.8rem]"
                  classNames={{
                    root: 'w-full',
                    month: 'w-full',
                    table: 'w-full',
                  }}
                />

                {!calendarTableReady && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    La table scheduled_sessions n'est pas disponible. Lance la migration SQL dédiée.
                  </div>
                )}

                {calendarError && (
                  <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {calendarError}
                  </div>
                )}
              </Card>
              
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Séances du {formatDisplayDate(date)}
                </h3>
                
                <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200/60 shadow-sm">
                  {calendarLoading ? (
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                      Chargement des séances planifiées...
                    </div>
                  ) : selectedDateSessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Aucune séance planifiée sur cette date.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[420px] pr-1">
                      <div className="space-y-3">
                        {selectedDateSessions.map((session) => {
                          const initials = session.client_name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()

                          return (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => navigate(`/coach/clients/${session.client_id}`)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-white"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <Avatar className="h-10 w-10 border border-slate-200">
                                    <AvatarImage src={session.client_avatar_url || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials || 'CL'}</AvatarFallback>
                                  </Avatar>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-900">{session.program_name}</p>
                                    <p className="truncate text-xs text-slate-500">{session.client_name}</p>
                                    {session.notes && (
                                      <p className="mt-1 truncate text-xs text-slate-500">Note: {session.notes}</p>
                                    )}
                                  </div>
                                </div>

                                <Badge className={getSessionStatusClassName(session.status)}>
                                  {formatSessionStatus(session.status)}
                                </Badge>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating Action Button for Group Messages */}
      <Button
        size="icon"
        onClick={() => setIsMessageDialogOpen(true)}
        className="fixed bottom-20 right-6 lg:bottom-10 lg:right-10 h-14 w-14 rounded-full bg-primary shadow-xl shadow-primary/30 hover:bg-primary/90 hover:scale-105 transition-all z-40"
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </Button>

      <BroadcastModal
        open={isMessageDialogOpen}
        onOpenChange={setIsMessageDialogOpen}
        clients={clients}
        onSend={handleBroadcastSend}
      />

      <AddClientDialog
        open={isAddClientDialogOpen}
        onOpenChange={setIsAddClientDialogOpen}
        onSubmit={handleAddClient}
        isSubmitting={saving}
      />

      <EditClientDialog
        open={isEditClientDialogOpen}
        client={editingClient}
        onOpenChange={(open) => {
          setIsEditClientDialogOpen(open)
          if (!open) setEditingClient(null)
        }}
        onSubmit={handleEditClient}
        isSubmitting={saving}
      />

      {error && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive shadow-sm">
          {error}
        </div>
      )}
    </div>
  )
}
