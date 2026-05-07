import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  MessageSquare,
  Sparkles,
  Trophy,
  Calendar,
  ClipboardList,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications, type AppNotification, type NotificationType } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const typeMeta: Record<
  NotificationType,
  { icon: LucideIcon; iconBg: string; iconColor: string }
> = {
  message: {
    icon: MessageSquare,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  program_request: {
    icon: ClipboardList,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  appointment_request: {
    icon: Calendar,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  program_assigned: {
    icon: Sparkles,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
  program_unassigned: {
    icon: X,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
  },
  workout_completed: {
    icon: Trophy,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
}

const formatRelative = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  const diffHr = Math.round(diffMs / 3600000)
  const diffDay = Math.round(diffMs / 86400000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHr < 24 && date.getDate() === now.getDate()) {
    return `aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (diffDay < 2) return 'hier'
  if (diffDay < 7) return `il y a ${diffDay} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

interface NotificationBellProps {
  className?: string
  buttonClassName?: string
}

export function NotificationBell({ className, buttonClassName }: NotificationBellProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, loading, tableReady, markAsRead, markAllAsRead } =
    useNotifications()

  const handleClickNotification = async (notification: AppNotification) => {
    setOpen(false)
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id)
      } catch (err) {
        // silent fail — UX is more important than the read flag
        console.warn('mark as read failed', err)
      }
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllAsRead()
    } catch (err) {
      console.warn('mark all as read failed', err)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
          className={cn(
            'relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-95',
            buttonClassName
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'w-[min(380px,calc(100vw-2rem))] p-0 overflow-hidden rounded-2xl border-slate-200 shadow-xl',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <p className="text-[11px] font-medium text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Tout est à jour'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              className="h-8 gap-1 rounded-lg text-[11px] font-bold text-primary hover:bg-primary/5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout lu
            </Button>
          )}
        </div>

        {/* Body */}
        {!tableReady ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm font-bold text-slate-700">Notifications indisponibles</p>
            <p className="mt-1 text-xs text-slate-500">
              La table <code>notifications</code> n'est pas encore configurée. Lance la migration
              SQL dédiée.
            </p>
          </div>
        ) : loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            Chargement…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-bold text-slate-700">Pas encore de notification</p>
            <p className="text-xs text-slate-500">
              Tu seras notifié dès qu'un client interagit avec toi.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const meta = typeMeta[notification.type] ?? typeMeta.message
                const Icon = meta.icon
                const unread = !notification.is_read

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleClickNotification(notification)}
                      className={cn(
                        'group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50',
                        unread && 'bg-primary/[0.04]'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          meta.iconBg
                        )}
                      >
                        <Icon className={cn('h-4 w-4', meta.iconColor)} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-[13px] leading-snug',
                              unread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'
                            )}
                          >
                            {notification.title}
                          </p>
                          {unread && (
                            <span
                              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                              aria-label="Non lu"
                            />
                          )}
                        </div>
                        {notification.body && (
                          <p
                            className={cn(
                              'mt-0.5 line-clamp-2 text-xs leading-snug',
                              unread ? 'text-slate-700' : 'text-slate-500'
                            )}
                          >
                            {notification.body}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {formatRelative(notification.created_at)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
