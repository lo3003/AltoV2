import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface ChatMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface CoachConversation {
  clientId: string
  participantId: string
  fullName: string
  email: string
  avatarUrl?: string | null
  lastMessageAt: string
  lastMessagePreview: string
  unreadCount: number
}

interface CoachClientRow {
  id: string | number
  auth_user_id?: string | null
  full_name?: string | null
  email?: string | null
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

const getClientIdentityIds = (client: CoachClientRow) => {
  const ids = new Set<string>()

  if (client.id != null) ids.add(String(client.id))
  if (client.auth_user_id) ids.add(String(client.auth_user_id))

  return Array.from(ids)
}

export function useCoachMessaging() {
  const { user } = useAuth()
  const [clients, setClients] = useState<CoachClientRow[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [tableReady, setTableReady] = useState(true)

  const clientByParticipantId = useMemo(() => {
    const map = new Map<string, CoachClientRow>()

    clients.forEach((client) => {
      getClientIdentityIds(client).forEach((identityId) => {
        map.set(identityId, client)
      })
    })

    return map
  }, [clients])

  const fetchClients = useCallback(async () => {
    if (!user?.id) {
      setClients([])
      return []
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, auth_user_id, full_name, email')
      .eq('coach_id', user.id)
      .order('full_name', { ascending: true })

    if (error) throw error

    const rows = (data || []) as CoachClientRow[]
    setClients(rows)
    return rows
  }, [user?.id])

  const fetchMessages = useCallback(async (clientRows?: CoachClientRow[]) => {
    if (!user?.id) {
      setMessages([])
      setTableReady(true)
      return
    }

    const source = clientRows || clients
    const ids = Array.from(
      new Set(
        source.flatMap((client) => getClientIdentityIds(client))
      )
    )

    if (ids.length === 0) {
      setMessages([])
      setTableReady(true)
      return
    }

    const list = ids.join(',')

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`and(sender_id.eq.${user.id},receiver_id.in.(${list})),and(receiver_id.eq.${user.id},sender_id.in.(${list}))`)
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
  }, [clients, user?.id])

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const clientRows = await fetchClients()
      await fetchMessages(clientRows)
    } finally {
      setLoading(false)
    }
  }, [fetchClients, fetchMessages, user?.id])

  useEffect(() => {
    void refresh()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`coach-messages-${user.id}`)
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

  const conversations = useMemo(() => {
    const grouped = new Map<string, ChatMessage[]>()

    messages.forEach((message) => {
      const counterpartId = message.sender_id === user?.id ? message.receiver_id : message.sender_id
      if (!clientByParticipantId.has(counterpartId)) return

      const current = grouped.get(counterpartId) || []
      current.push(message)
      grouped.set(counterpartId, current)
    })

    const result: CoachConversation[] = []

    grouped.forEach((conversationMessages, participantId) => {
      const client = clientByParticipantId.get(participantId)
      if (!client || conversationMessages.length === 0) return

      const lastMessage = conversationMessages[conversationMessages.length - 1]
      const unreadCount = conversationMessages.filter(
        (message) => message.receiver_id === user?.id && !message.is_read
      ).length

      result.push({
        clientId: String(client.id),
        participantId,
        fullName: client.full_name || client.email || 'Client',
        email: client.email || '',
        lastMessageAt: lastMessage.created_at,
        lastMessagePreview: lastMessage.content,
        unreadCount,
      })
    })

    return result.sort(
      (left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
    )
  }, [clientByParticipantId, messages, user?.id])

  const getConversationMessages = useCallback((participantId: string) => {
    return messages
      .filter((message) => {
        return (
          (message.sender_id === user?.id && message.receiver_id === participantId)
          || (message.receiver_id === user?.id && message.sender_id === participantId)
        )
      })
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
  }, [messages, user?.id])

  const sendMessage = useCallback(async (participantId: string, content: string) => {
    if (!user?.id) throw new Error('Coach non connecté')

    const cleanContent = content.trim()
    if (!cleanContent) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: participantId,
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
  }, [fetchMessages, user?.id])

  const markConversationAsRead = useCallback(async (participantId: string) => {
    if (!user?.id) return

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', participantId)
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
  }, [fetchMessages, user?.id])

  const sendBroadcastMessage = useCallback(async (participantIdsToSend: string[], content: string) => {
    if (!user?.id) throw new Error('Coach non connecté')

    const cleanContent = content.trim()
    if (!cleanContent) throw new Error('Le message est vide.')

    const uniqueParticipantIds = Array.from(new Set(participantIdsToSend.map((id) => String(id))))
    if (uniqueParticipantIds.length === 0) throw new Error('Aucun client sélectionné.')

    const payload = uniqueParticipantIds.map((participantId) => ({
      sender_id: user.id,
      receiver_id: participantId,
      content: cleanContent,
      is_read: false,
    }))

    const { error } = await supabase
      .from('messages')
      .insert(payload)

    if (error) {
      if (isMissingMessagesTableError(error)) {
        setTableReady(false)
        throw new Error('La table messages est absente. Lancez la migration SQL dédiée.')
      }
      throw error
    }

    await fetchMessages()
    setTableReady(true)

    return uniqueParticipantIds.length
  }, [fetchMessages, user?.id])

  return {
    clients,
    conversations,
    loading,
    sending,
    tableReady,
    refresh,
    getConversationMessages,
    sendMessage,
    markConversationAsRead,
    sendBroadcastMessage,
  }
}
