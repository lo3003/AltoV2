import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCoachClients, type ClientFormInput, type CoachClient } from '@/hooks/useCoachClients'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, MessageSquare, Calendar as CalendarIcon, Filter, Plus, Pencil } from 'lucide-react'
import { CoachHeader } from '@/components/coach/CoachHeader'
import { AddClientDialog } from '@/components/coach/AddClientDialog'
import { EditClientDialog } from '@/components/coach/EditClientDialog'
import { BroadcastModal } from '@/components/coach/BroadcastModal'
import { toast } from 'sonner'
import { Calendar } from '@/components/ui/calendar'

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
  
  // Fake global calendar date
  const [date, setDate] = useState<Date | undefined>(new Date())

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
    <div className="flex h-[100dvh] flex-col bg-slate-50 relative">
      <CoachHeader
        title="Mes Clients"
        subtitle="Vues liste et calendrier global."
        onNewProgram={() => setIsAddClientDialogOpen(true)}
      />

      <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 custom-scrollbar">
        <div className="mx-auto max-w-7xl space-y-6">
          
          {/* Header Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="list">Liste des Clients</TabsTrigger>
                <TabsTrigger value="calendar">Calendrier Global</TabsTrigger>
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
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
                  <Filter className="h-4 w-4 text-slate-600" />
                </Button>
                <Button
                  onClick={() => setIsAddClientDialogOpen(true)}
                  className="gap-2 rounded-xl bg-[#10b981] font-semibold text-white shadow-sm hover:bg-[#059669]"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un client
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
                <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl ring-1 ring-slate-200/60 border-dashed border-2">
                  <p>Aucun client trouvé.</p>
                </div>
              )}
            </div>
          )}

          {/* CALENDAR TAB */}
          {activeTab === 'calendar' && (
            <div className="grid gap-6 lg:grid-cols-[auto_1fr] items-start pb-20">
              <Card className="border-none bg-white shadow-sm ring-1 ring-slate-200/60 p-4 rounded-3xl w-fit mx-auto lg:mx-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-xl border-0"
                />
              </Card>
              
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Séances du {date?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                
                <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200/60 space-y-4 shadow-sm">
                  {/* Mock Data inside */}
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-1.5 h-full rounded-full bg-emerald-500" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">Push Day (Progression)</p>
                      <p className="text-xs mt-1 text-slate-500">Thomas Martin • Programme Hypertrophie Avancé</p>
                    </div>
                    <Badge variant="outline" className="bg-white">Séance validée</Badge>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-1.5 h-full rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">Bilan Mensuel & Feedback</p>
                      <p className="text-xs mt-1 text-slate-500">Julie Roussel • Call Zoom - 18h30</p>
                    </div>
                    <Badge variant="outline" className="bg-white">À venir</Badge>
                  </div>
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
