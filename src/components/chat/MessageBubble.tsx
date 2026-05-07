import { Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/useCoachMessaging'

interface MessageBubbleProps {
  message: ChatMessage
  isOwnMessage: boolean
  showAuthor?: boolean
  authorInitials?: string
}

const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({
  message,
  isOwnMessage,
  showAuthor = false,
  authorInitials,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'flex w-full items-end gap-2',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Avatar slot for the other party (only when showing author + not own) */}
      {!isOwnMessage && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
          {showAuthor ? authorInitials || '·' : ''}
        </div>
      )}

      <div
        className={cn(
          'max-w-[75%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
          isOwnMessage
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md bg-white ring-1 ring-slate-200/70 text-slate-800'
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[10px] font-medium',
            isOwnMessage ? 'text-primary-foreground/80' : 'text-slate-400'
          )}
        >
          <span>{formatTime(message.created_at)}</span>
          {isOwnMessage && (
            message.is_read ? (
              <CheckCheck className="h-3 w-3 text-emerald-200" aria-label="Lu" />
            ) : (
              <Check className="h-3 w-3" aria-label="Envoyé" />
            )
          )}
        </div>
      </div>
    </div>
  )
}
