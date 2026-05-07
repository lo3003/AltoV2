import { useMemo, useState } from 'react'
import { Search, MessageCircleOff, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CoachConversation } from '@/hooks/useCoachMessaging'

interface ChatSidebarProps {
  conversations: CoachConversation[]
  selectedParticipantId: string | null
  onSelectConversation: (participantId: string) => void
  onBrowseClients?: () => void
}

const formatRelative = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  const diffHr = Math.round(diffMs / 3600000)
  const diffDay = Math.round(diffMs / 86400000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `${diffMin} min`
  if (diffHr < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDay < 2) return 'Hier'
  if (diffDay < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' })

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const buildInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'CL'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function ChatSidebar({
  conversations,
  selectedParticipantId,
  onSelectConversation,
  onBrowseClients,
}: ChatSidebarProps) {
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  )

  const visibleConversations = useMemo(() => {
    const q = normalize(query.trim())
    return conversations.filter((c) => {
      if (filterMode === 'unread' && c.unreadCount === 0) return false
      if (!q) return true
      return (
        normalize(c.fullName).includes(q) ||
        normalize(c.email).includes(q) ||
        normalize(c.lastMessagePreview).includes(q)
      )
    })
  }, [conversations, filterMode, query])

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MessageSquare className="h-4 w-4 text-primary" />
            Conversations
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            {conversations.length} contact{conversations.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client…"
            className="h-9 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm focus-visible:bg-white"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5">
          <FilterChip
            active={filterMode === 'all'}
            onClick={() => setFilterMode('all')}
            label={`Tous (${conversations.length})`}
          />
          <FilterChip
            active={filterMode === 'unread'}
            onClick={() => setFilterMode('unread')}
            label={`Non lus${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
            highlight={totalUnread > 0}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-5 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <MessageCircleOff className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-bold text-slate-700">Aucune conversation</p>
              <p className="mt-1 text-xs text-slate-500">
                Quand un client t'enverra un message, il apparaîtra ici.
              </p>
              {onBrowseClients && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onBrowseClients}
                  className="mt-3 h-9 rounded-lg border-primary/30 font-bold text-primary hover:bg-primary/5"
                >
                  Voir mes clients
                </Button>
              )}
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">
                {filterMode === 'unread'
                  ? 'Aucun message non lu. 🎉'
                  : 'Aucun client ne correspond à ta recherche.'}
              </p>
            </div>
          ) : (
            visibleConversations.map((conversation) => {
              const isSelected = conversation.participantId === selectedParticipantId
              const initials = buildInitials(conversation.fullName)
              const hasUnread = conversation.unreadCount > 0

              return (
                <button
                  key={conversation.participantId}
                  onClick={() => onSelectConversation(conversation.participantId)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-primary/10 ring-1 ring-primary/20'
                      : hasUnread
                        ? 'hover:bg-primary/5'
                        : 'hover:bg-slate-50'
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11 border border-slate-200">
                      <AvatarImage src={conversation.avatarUrl || undefined} />
                      <AvatarFallback
                        className={cn(
                          'text-xs font-bold',
                          isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                        )}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'truncate text-sm',
                          hasUnread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'
                        )}
                      >
                        {conversation.fullName}
                      </p>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] font-bold tabular-nums',
                          hasUnread ? 'text-primary' : 'text-slate-400'
                        )}
                      >
                        {formatRelative(conversation.lastMessageAt)}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-2">
                      <p
                        className={cn(
                          'truncate text-xs',
                          hasUnread ? 'font-semibold text-slate-700' : 'text-slate-400'
                        )}
                      >
                        {conversation.lastMessagePreview}
                      </p>
                      {hasUnread && (
                        <Badge className="ml-auto h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-extrabold text-white border-none">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  highlight = false,
}: {
  active: boolean
  onClick: () => void
  label: string
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors',
        active
          ? 'bg-primary text-white shadow-sm shadow-primary/20'
          : highlight
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {label}
    </button>
  )
}
