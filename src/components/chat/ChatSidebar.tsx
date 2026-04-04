import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CoachConversation } from '@/hooks/useCoachMessaging'

interface ChatSidebarProps {
  conversations: CoachConversation[]
  selectedParticipantId: string | null
  onSelectConversation: (participantId: string) => void
}

const formatRelative = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function ChatSidebar({
  conversations,
  selectedParticipantId,
  onSelectConversation,
}: ChatSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Conversations</h2>
          <span className="text-xs font-medium text-slate-400">{conversations.length}</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
              Aucune conversation pour le moment.
            </div>
          ) : conversations.map((conversation) => {
            const isSelected = conversation.participantId === selectedParticipantId
            const initials = conversation.fullName
              .split(' ')
              .map((name) => name[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            return (
              <button
                key={conversation.participantId}
                onClick={() => onSelectConversation(conversation.participantId)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  isSelected
                    ? 'bg-primary/10'
                    : 'hover:bg-slate-50'
                )}
              >
                <Avatar className="h-9 w-9 border border-slate-200">
                  <AvatarImage src={conversation.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials || 'CL'}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('truncate text-sm', conversation.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700')}>
                      {conversation.fullName}
                    </p>
                    <span className="text-[10px] text-slate-400">{formatRelative(conversation.lastMessageAt)}</span>
                  </div>

                  <p className={cn('truncate text-xs', conversation.unreadCount > 0 ? 'font-semibold text-slate-700' : 'text-slate-400')}>
                    {conversation.lastMessagePreview}
                  </p>
                </div>

                {conversation.unreadCount > 0 && (
                  <Badge className="h-5 min-w-5 rounded-full bg-destructive text-[10px] text-white">
                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
