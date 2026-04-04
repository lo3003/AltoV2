import { useEffect, useRef, useState } from 'react'
import { MessageCircleMore, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { useClientMessaging } from '@/hooks/useClientMessaging'

export default function ClientMessagesPage() {
  const { user } = useAuth()
  const {
    coachId,
    messages,
    loading,
    sending,
    tableReady,
    markAsRead,
    sendMessage,
  } = useClientMessaging()

  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const hasUnreadIncoming = messages.some((message) => message.receiver_id === user?.id && !message.is_read)
    if (!hasUnreadIncoming) return
    void markAsRead()
  }, [markAsRead, messages, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const cleanDraft = draft.trim()
    if (!cleanDraft) return

    try {
      await sendMessage(cleanDraft)
      setDraft('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'envoi du message.'
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircleMore className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-slate-900">Conversation avec ton coach</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {coachId ? 'Messagerie directe active.' : 'Aucun coach assigné actuellement.'}
          </p>
        </div>

        {!tableReady && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Table messages indisponible. Lance la migration SQL dédiée.
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 bg-slate-50/30 p-4">
          <div className="space-y-3">
            {loading ? (
              <Card className="border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Chargement de la conversation...</Card>
            ) : messages.length === 0 ? (
              <Card className="border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Aucun message pour le moment. Démarre la discussion 👋</Card>
            ) : (
              messages.map((message) => (
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
              placeholder="Écris ton message..."
              className="h-10 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
              disabled={!coachId || sending}
            />
            <Button type="submit" disabled={!coachId || sending || !draft.trim()} className="h-10 px-3">
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
