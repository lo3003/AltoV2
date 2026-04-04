import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/useCoachMessaging'

interface MessageBubbleProps {
  message: ChatMessage
  isOwnMessage: boolean
}

const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  return (
    <div className={cn('flex w-full', isOwnMessage ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-slate-100 text-slate-800'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={cn('mt-1 text-[10px] font-medium', isOwnMessage ? 'text-primary-foreground/70' : 'text-slate-500')}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}
