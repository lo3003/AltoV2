import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCoachDashboard } from '@/hooks/useCoachDashboard'
import type { CoachClient, WorkoutLog } from '@/hooks/useCoachDashboard'
import { CoachHeader } from '@/components/coach/CoachHeader'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import {
  Users,
  Calendar,
  Activity,
  CheckCircle2,
  Search,
  ChevronRight,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CoachDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { clients, recentLogs, stats, loading, error } = useCoachDashboard()
  const [searchQuery, setSearchQuery] = useState('')

  const coachName = user?.fullName || user?.email?.split('@')[0] || 'Alex'
  
  // Format current date "Lundi 24 Mai 2024"
  const today = new Date()
  const dateString = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).replace(/^\w/, (c) => c.toUpperCase())

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return clients

    return clients.filter((client) => {
      const fullName = String(client.full_name || '').toLowerCase()
      const email = String(client.email || '').toLowerCase()
      const clientCode = String(client.client_code || '').toLowerCase()
      return fullName.includes(query) || email.includes(query) || clientCode.includes(query)
    })
  }, [clients, searchQuery])

  const lastActivityByClientId = useMemo(() => {
    const map = new Map<string, WorkoutLog>()
    recentLogs.forEach((log) => {
      if (!map.has(String(log.client_id))) {
        map.set(String(log.client_id), log)
      }
    })
    return map
  }, [recentLogs])

  const getClientNameFromLog = (log: WorkoutLog) => {
    const relation = Array.isArray(log.clients) ? log.clients[0] : log.clients
    return relation?.full_name || 'Client'
  }

  const getProgramNameFromLog = (log: WorkoutLog) => {
    const relation = Array.isArray(log.programs) ? log.programs[0] : log.programs
    return relation?.name || 'Séance'
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="flex h-full flex-col">
      <CoachHeader
        title={`Bonjour, ${coachName} 👋`}
        subtitle={`${dateString} • Voici l'activité du jour.`}
        onNewProgram={() => navigate('/coach/clients?openAdd=1')}
      />

      <div className="flex-1 space-y-5 px-4 pt-4 lg:max-w-[1400px] lg:space-y-6 lg:px-8">
        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Stats Row — compact on mobile */}
        <div className="grid grid-cols-3 gap-2 lg:gap-6 lg:grid-cols-3">
          <StatCard
            icon={<Users className="h-6 w-6 text-[#10b981]" />}
            iconBg="bg-[#10b981]/10"
            label="Clients Actifs"
            value={String(stats.activeClients)}
          />
          <StatCard
            icon={<Calendar className="h-6 w-6 text-[#3b82f6]" />}
            iconBg="bg-[#3b82f6]/10"
            label="Séances cette semaine"
            value={String(stats.completedSessionsWeek)}
          />
          <StatCard
            icon={<Activity className="h-6 w-6 text-[#f59e0b]" />}
            iconBg="bg-[#f59e0b]/10"
            label="Séances ce mois"
            value={String(stats.completedSessionsMonth)}
          />
        </div>

        {/* Content Layout: 1/3 + 2/3 */}
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr] pb-8">
          
          {/* Left: Recent Activity */}
          <div className="flex flex-col">
            <Card className="flex flex-col border-none bg-white shadow-sm ring-1 ring-slate-200/60 rounded-2xl overflow-hidden lg:max-h-[640px]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                <h3 className="text-[17px] font-bold text-slate-900">Activité récente</h3>
                <button
                  onClick={() => navigate('/coach/clients')}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
                >
                  Voir tout
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
                {recentLogs.length > 0 ? (
                  recentLogs.map((log) => {
                    const clientId = String(log.client_id)
                    return (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => navigate(`/coach/clients/${clientId}`)}
                        className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-primary/5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200 transition-colors">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {getClientNameFromLog(log)} a fini sa séance
                          </p>
                          <p className="text-[12px] text-slate-500 truncate">
                            {getProgramNameFromLog(log)} · {new Date(log.completed_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                      </button>
                    )
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center mx-2 my-3">
                    <Activity className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">Aucune activité récente</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Les séances complétées par tes clients apparaîtront ici.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Clients Overview */}
          <div className="flex flex-col">
            <Card className="flex flex-col border-none bg-white shadow-sm ring-1 ring-slate-200/60 rounded-2xl overflow-hidden lg:max-h-[640px]">
              <div className="p-6 pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-[17px] font-bold text-slate-900">Aperçu des Clients</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      placeholder="Filtrer les clients..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-9 w-full sm:w-[240px] rounded-lg border-none bg-slate-100 pl-9 text-sm text-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-[2fr_1.5fr_1.5fr_auto] items-center gap-4 border-b border-slate-100 bg-white px-6 py-3 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Objectif</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dernière activité</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3">Actions</span>
              </div>

              {/* Table Rows (scrollable) */}
              <div className="flex-1 divide-y divide-slate-100 overflow-y-auto custom-scrollbar">
                  {filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <ClientRow
                        key={client.id}
                        client={client}
                        lastActivity={lastActivityByClientId.get(String(client.id))}
                        onOpen={() => navigate(`/coach/clients/${client.id}`)}
                      />
                    ))
                  ) : clients.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                        <Sparkles className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Aucun client pour l'instant</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Crée ton premier client pour commencer à le suivre.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => navigate('/coach/clients?openAdd=1')}
                        className="mt-4 h-10 gap-1.5 rounded-xl bg-primary font-bold shadow-sm shadow-primary/20 hover:bg-primary/90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Ajouter un client
                      </Button>
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-sm text-slate-500">
                      Aucun client ne correspond à ce filtre.
                    </div>
                  )}
                </div>

              <button
                onClick={() => navigate('/coach/clients')}
                className="flex w-full items-center justify-center gap-1 border-t border-slate-100 p-4 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 shrink-0"
              >
                Voir tous les clients
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
}) {
  return (
    <Card className="border-none bg-white shadow-sm ring-1 ring-slate-200/60 rounded-2xl">
      <CardContent className="p-3 lg:p-6">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg lg:h-12 lg:w-12 lg:rounded-xl ${iconBg}`}>
          <span className="lg:scale-100 scale-75">{icon}</span>
        </div>
        <div className="mt-3 lg:mt-6">
          <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:text-[13px] lg:normal-case lg:tracking-normal">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums tracking-tight text-slate-900 lg:mt-1 lg:text-3xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ClientRow({
  client,
  lastActivity,
  onOpen,
}: {
  client: CoachClient
  lastActivity?: WorkoutLog
  onOpen: () => void
}) {
  const initials = client.full_name
    ? client.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  const lastActivityLabel = (() => {
    if (!lastActivity) return 'Aucune séance'

    const date = new Date(lastActivity.completed_at)
    const now = new Date()
    const sameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    return sameDay
      ? `Aujourd'hui, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[2fr_1.5fr_1.5fr_auto] items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-primary/5"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-slate-900">{client.full_name || client.email}</p>
          <p className="text-[12px] text-slate-500">Code : {client.client_code}</p>
        </div>
      </div>

      <div>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">
          {client.main_goal || 'Perte de poids'}
        </span>
      </div>

      <div className="text-[13px] font-medium text-slate-600 truncate">
        {lastActivityLabel}
      </div>

      <div className="flex justify-end pr-2">
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </button>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="h-44 bg-slate-50" />
    </div>
  )
}
