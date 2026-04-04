import { useEffect, useMemo, useRef, useState } from 'react'
import { SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { useCoachMessaging } from '@/hooks/useCoachMessaging'

export default function CoachMessagesPage() {
  const { user } = useAuth()
  const {
    conversations,
    loading,
    sending,
    tableReady,
    getConversationMessages,
    sendMessage,
    markConversationAsRead,
  } = useCoachMessaging()

  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedParticipantId(null)
      return
    }

    const stillExists = conversations.some((conversation) => conversation.participantId === selectedParticipantId)
    if (!selectedParticipantId || !stillExists) {
      setSelectedParticipantId(conversations[0].participantId)
    }
  }, [conversations, selectedParticipantId])

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.participantId === selectedParticipantId) || null
  }, [conversations, selectedParticipantId])

  useEffect(() => {
    if (!selectedParticipantId) return
    if (!selectedConversation || selectedConversation.unreadCount <= 0) return
    void markConversationAsRead(selectedParticipantId)
  }, [markConversationAsRead, selectedConversation, selectedParticipantId])

  const activeMessages = useMemo(() => {
    if (!selectedParticipantId) return []
    return getConversationMessages(selectedParticipantId)
  }, [getConversationMessages, selectedParticipantId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, selectedParticipantId])

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedParticipantId) {
      toast.error('Sélectionne une conversation.')
      return
    }

    const nextDraft = draft.trim()
    if (!nextDraft) return

    try {
      await sendMessage(selectedParticipantId, nextDraft)
      setDraft('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'envoi du message.'
      toast.error(message)
    }
  }

  return (
    <div className="mx-4 my-4 flex min-h-[calc(100svh-7rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 lg:mx-8 lg:mb-8 lg:min-h-[calc(100svh-8.5rem)]">
      <div className="flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[340px_1fr]">
        <div className="h-60 shrink-0 border-b border-slate-200 lg:h-full lg:border-b-0">
          <ChatSidebar
            conversations={conversations}
            selectedParticipantId={selectedParticipantId}
            onSelectConversation={setSelectedParticipantId}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            {selectedConversation ? (
              <>
                <p className="text-sm font-semibold text-slate-900">{selectedConversation.fullName}</p>
                <p className="text-xs text-slate-500">{selectedConversation.email}</p>
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-700">Sélectionne une conversation</p>
            )}
          </div>

          {!tableReady && (
            <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Table messages indisponible. Lance la migration SQL dédiée.
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1 bg-slate-50/30 p-4">
            <div className="space-y-3">
              {loading ? (
                <Card className="border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Chargement des conversations...</Card>
              ) : !selectedConversation ? (
                <Card className="border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Aucune conversation disponible.</Card>
              ) : activeMessages.length === 0 ? (
                <Card className="border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Aucun message pour le moment.</Card>
              ) : (
                activeMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwnMessage={message.sender_id === user?.id}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Écris un message..."
                className="h-10 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                disabled={!selectedConversation || sending}
              />
              <Button type="submit" disabled={!selectedConversation || sending || !draft.trim()} className="h-10 px-3">
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
