import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export type NotificationType =
  | 'message'
  | 'program_request'
  | 'appointment_request'
  | 'program_assigned'
  | 'program_unassigned'
  | 'workout_completed'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  actor_id: string | null
  actor_name: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

interface UseNotificationsResult {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  tableReady: boolean
  error: string | null
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refetch: () => Promise<void>
}

const NOTIFICATIONS_LIMIT = 30

const isMissingTableError = (err: any) => {
  if (!err) return false
  const code = String(err.code || '')
  const message = String(err.message || '').toLowerCase()
  if (code === '42P01' || code === 'PGRST205') return true
  return message.includes('notifications') && (message.includes('does not exist') || message.includes('could not find'))
}

/**
 * Fetches the current user's notifications and subscribes to Realtime updates.
 * Auto-merges new rows into local state when the Edge Function inserts a notification
 * (live updates require Realtime to be enabled on the `notifications` table).
 */
export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATIONS_LIMIT)

      if (fetchError) {
        if (isMissingTableError(fetchError)) {
          setTableReady(false)
          setNotifications([])
          return
        }
        throw fetchError
      }

      setTableReady(true)
      setNotifications((data || []) as AppNotification[])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des notifications.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription — receive new notifications live
  useEffect(() => {
    if (!user?.id || !tableReady) return

    // Cleanup any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as AppNotification
          setNotifications((prev) => {
            // de-dupe by id (in case a refetch happened in parallel)
            if (prev.some((n) => n.id === next.id)) return prev
            return [next, ...prev].slice(0, NOTIFICATIONS_LIMIT)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as AppNotification
          setNotifications((prev) => prev.map((n) => (n.id === next.id ? next : n)))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [user?.id, tableReady])

  const unreadCount = useMemo(
    () => notifications.reduce((sum, n) => sum + (n.is_read ? 0 : 1), 0),
    [notifications]
  )

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (updateError) {
        // Rollback
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
        )
        throw updateError
      }
    },
    []
  )

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (updateError) {
      // Rollback
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: false } : n))
      )
      throw updateError
    }
  }, [notifications, user?.id])

  return {
    notifications,
    unreadCount,
    loading,
    tableReady,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
