import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const isMissingMessagesTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false

  const code = String((error as { code?: string }).code || '')
  const message = String((error as { message?: string }).message || '').toLowerCase()

  if (code === '42P01' || code === 'PGRST205') return true
  return message.includes('messages') && (message.includes('does not exist') || message.includes('could not find'))
}

export function useUnreadMessages() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const getIdentityIds = useCallback(async () => {
    if (!user?.id) return []

    const identities = new Set<string>([String(user.id)])

    if (user.role === 'client') {
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!error && data?.id != null) {
        identities.add(String(data.id))
      }
    }

    return Array.from(identities)
  }, [user?.id, user?.role])

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const identityIds = await getIdentityIds()
      if (identityIds.length === 0) {
        setUnreadCount(0)
        return
      }

      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('receiver_id', identityIds)
        .eq('is_read', false)

      if (error) {
        if (isMissingMessagesTableError(error)) {
          setUnreadCount(0)
          return
        }
        throw error
      }

      setUnreadCount(count || 0)
    } finally {
      setLoading(false)
    }
  }, [getIdentityIds, user?.id])

  useEffect(() => {
    fetchUnreadCount()

    if (!user?.id) return

    const channel = supabase
      .channel(`unread-messages-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const row = (payload.new || payload.old || {}) as { receiver_id?: string; sender_id?: string }
        if (String(row.receiver_id || '') || String(row.sender_id || '')) {
          fetchUnreadCount()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchUnreadCount, user?.id])

  return {
    unreadCount,
    loading,
    refreshUnreadCount: fetchUnreadCount,
  }
}
