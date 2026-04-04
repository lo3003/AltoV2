import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ChatMessage } from '@/hooks/useCoachMessaging'

interface ClientRow {
  id: string | number
  auth_user_id?: string | null
  coach_id?: string | number | null
}

interface MessageRow {
  id: string | number
  sender_id: string | number
  receiver_id: string | number
  content?: string | null
  is_read?: boolean | null
  created_at: string
}

const toMessage = (row: MessageRow): ChatMessage => ({
  id: String(row.id),
  sender_id: String(row.sender_id),
  receiver_id: String(row.receiver_id),
  content: String(row.content || ''),
  is_read: Boolean(row.is_read),
  created_at: row.created_at,
})

const isMissingMessagesTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false

  const code = String((error as { code?: string }).code || '')
  const message = String((error as { message?: string }).message || '').toLowerCase()

  if (code === '42P01' || code === 'PGRST205') return true
  return message.includes('messages') && (message.includes('does not exist') || message.includes('could not find'))
}

export function useClientMessaging() {
  const { user } = useAuth()
  const [coachIds, setCoachIds] = useState<string[]>([])
  const [selfIds, setSelfIds] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [tableReady, setTableReady] = useState(true)

  const fetchParticipantContext = useCallback(async () => {
    if (!user?.id) {
      setCoachIds([])
      setSelfIds([])
      return null
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, auth_user_id, coach_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error) throw error

    const row = data as ClientRow | null
    const nextCoachIds = row?.coach_id != null ? [String(row.coach_id)] : []
    const nextSelfIds = row?.id != null
      ? Array.from(new Set([String(user.id), String(row.id)]))
      : [String(user.id)]

    setCoachIds(nextCoachIds)
    setSelfIds(nextSelfIds)

    return {
      coachIds: nextCoachIds,
      selfIds: nextSelfIds,
    }
  }, [user?.id])

  const fetchMessages = useCallback(async (forcedContext?: { coachIds: string[]; selfIds: string[] }) => {
    if (!user?.id) {
      setMessages([])
      setTableReady(true)
      return
    }

    const activeCoachIds = forcedContext?.coachIds || coachIds
    const activeSelfIds = forcedContext?.selfIds || selfIds

    if (activeCoachIds.length === 0 || activeSelfIds.length === 0) {
      setMessages([])
      setTableReady(true)
      return
    }

    const coachList = activeCoachIds.join(',')
    const selfList = activeSelfIds.join(',')

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`and(sender_id.in.(${selfList}),receiver_id.in.(${coachList})),and(sender_id.in.(${coachList}),receiver_id.in.(${selfList}))`)
      .order('created_at', { ascending: true })

    if (error) {
      if (isMissingMessagesTableError(error)) {
        setTableReady(false)
        setMessages([])
        return
      }
      throw error
    }

    setMessages(((data || []) as MessageRow[]).map(toMessage))
    setTableReady(true)
  }, [coachIds, selfIds, user?.id])

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const context = await fetchParticipantContext()
      if (context) {
        await fetchMessages(context)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchMessages, fetchParticipantContext, user?.id])

  useEffect(() => {
    void refresh()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`client-messages-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const row = (payload.new || payload.old || {}) as { receiver_id?: string; sender_id?: string }
        if (String(row.receiver_id || '') === user.id || String(row.sender_id || '') === user.id) {
          void fetchMessages()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMessages, user?.id])

  const sendMessage = useCallback(async (content: string) => {
    if (!user?.id) throw new Error('Client non connecté')
    if (coachIds.length === 0) throw new Error('Aucun coach assigné.')

    const cleanContent = content.trim()
    if (!cleanContent) return

    const primaryCoachId = coachIds[0]

    setSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: primaryCoachId,
          content: cleanContent,
          is_read: false,
        })

      if (error) {
        if (isMissingMessagesTableError(error)) {
          setTableReady(false)
          throw new Error('La table messages est absente. Lancez la migration SQL dédiée.')
        }
        throw error
      }

      await fetchMessages()
      setTableReady(true)
    } finally {
      setSending(false)
    }
  }, [coachIds, fetchMessages, user?.id])

  const markAsRead = useCallback(async () => {
    if (!user?.id || coachIds.length === 0 || selfIds.length === 0) return

    const activeCoachIds = coachIds
    const activeSelfIds = selfIds

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .in('receiver_id', activeSelfIds)
      .in('sender_id', activeCoachIds)
      .eq('is_read', false)

    if (error) {
      if (isMissingMessagesTableError(error)) {
        setTableReady(false)
        return
      }
      throw error
    }

    await fetchMessages()
    setTableReady(true)
  }, [coachIds, fetchMessages, selfIds, user?.id])

  const sortedMessages = useMemo(() => {
    return [...messages].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
  }, [messages])

  return {
    coachId: coachIds[0] || null,
    messages: sortedMessages,
    loading,
    sending,
    tableReady,
    refresh,
    sendMessage,
    markAsRead,
  }
}
