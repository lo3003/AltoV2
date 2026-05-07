import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SendHorizonal,
  ArrowLeft,
  ChevronRight,
  MessageSquare,
  Mail,
  Megaphone,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { useCoachMessaging, type ChatMessage } from '@/hooks/useCoachMessaging'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const buildInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'CL'

const toDateKey = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatDateLabel = (key: string) => {
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  if (target.getTime() === today.getTime()) return "Aujourd'hui"
  if (target.getTime() === yesterday.getTime()) return 'Hier'
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type FeedItem =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'message'; message: ChatMessage }

const groupMessagesByDay = (messages: ChatMessage[]): FeedItem[] => {
  const items: FeedItem[] = []
  let lastKey = ''

  messages.forEach((message) => {
    const key = toDateKey(message.created_at)
    if (key && key !== lastKey) {
      items.push({ kind: 'divider', key, label: formatDateLabel(key) })
      lastKey = key
    }
    items.push({ kind: 'message', message })
  })

  return items
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CoachMessagesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
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
  const [showMobileChat, setShowMobileChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedParticipantId(null)
      return
    }

    const stillExists = conversations.some(
      (conversation) => conversation.participantId === selectedParticipantId
    )
    if (!selectedParticipantId || !stillExists) {
      setSelectedParticipantId(conversations[0].participantId)
    }
  }, [conversations, selectedParticipantId])

  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.participantId === selectedParticipantId) || null
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

  const feed = useMemo(() => groupMessagesByDay(activeMessages), [activeMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, selectedParticipantId])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [draft])

  const handleSend = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    if (!selectedParticipantId) {
      toast.error('Sélectionne une conversation.')
      return
    }
    const next = draft.trim()
    if (!next) return

    try {
      await sendMessage(selectedParticipantId, next)
      setDraft('')
      // Reset textarea height
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi du message."
      toast.error(message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter → send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSend()
    }
    // Plain Enter → send (Shift+Enter = new line)
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleSelectConversation = (participantId: string) => {
    setSelectedParticipantId(participantId)
    setShowMobileChat(true)
  }

  const otherInitials = selectedConversation ? buildInitials(selectedConversation.fullName) : ''
  const placeholderText = selectedConversation
    ? `Message à ${selectedConversation.fullName.split(' ')[0]}…`
    : 'Sélectionne une conversation pour écrire…'

  return (
    <div className="mx-4 my-4 flex h-[calc(100svh-7rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 lg:mx-8 lg:mb-8 lg:h-[calc(100svh-8.5rem)]">
      <div className="flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[340px_1fr] lg:grid-rows-1">
        {/* Sidebar */}
        <div
          className={cn(
            'shrink-0 border-b border-slate-200 lg:h-full lg:border-b-0 lg:border-r',
            showMobileChat ? 'hidden lg:block' : 'flex h-full min-h-[280px] flex-col lg:max-h-none'
          )}
        >
          <ChatSidebar
            conversations={conversations}
            selectedParticipantId={selectedParticipantId}
            onSelectConversation={handleSelectConversation}
            onBrowseClients={() => navigate('/coach/clients')}
          />
        </div>

        {/* Chat area */}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/30 lg:h-full',
            !showMobileChat && 'hidden lg:flex'
          )}
        >
          {/* Chat Header */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 lg:px-5 lg:py-4">
            {/* Mobile back */}
            <button
              type="button"
              onClick={() => setShowMobileChat(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Retour à la liste"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {selectedConversation ? (
              <>
                <Avatar className="h-10 w-10 border border-slate-200">
                  <AvatarImage src={selectedConversation.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                    {otherInitials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {selectedConversation.fullName}
                  </p>
                  <p className="truncate text-[11px] font-medium text-slate-500">
                    {selectedConversation.email}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/coach/clients/${selectedConversation.clientId}`)}
                  className="hidden gap-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-primary/5 hover:text-primary sm:inline-flex"
                  title="Voir le profil du client"
                >
                  Voir profil
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/coach/clients/${selectedConversation.clientId}`)}
                  className="h-9 w-9 rounded-lg text-slate-500 hover:bg-primary/5 hover:text-primary sm:hidden"
                  title="Voir le profil du client"
                  aria-label="Voir le profil du client"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-700">Aucune conversation sélectionnée</p>
            )}
          </div>

          {/* Table not ready warning */}
          {!tableReady && (
            <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 lg:mx-5">
              Table <code>messages</code> indisponible. Lance la migration SQL dédiée.
            </div>
          )}

          {/* Messages feed */}
          <ScrollArea className="min-h-0 flex-1 px-3 py-4 lg:px-5">
            <div className="mx-auto max-w-2xl space-y-3">
              {loading ? (
                <div className="rounded-xl bg-white p-5 text-center text-sm text-slate-500 ring-1 ring-slate-200/60">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" />
                  Chargement des conversations…
                </div>
              ) : !selectedConversation ? (
                <EmptyChatState
                  onBrowseClients={() => navigate('/coach/clients')}
                  hasConversations={conversations.length > 0}
                />
              ) : activeMessages.length === 0 ? (
                <FirstMessageHint
                  clientName={selectedConversation.fullName.split(' ')[0]}
                  onFocusInput={() => textareaRef.current?.focus()}
                />
              ) : (
                feed.map((item) => {
                  if (item.kind === 'divider') {
                    return (
                      <div key={`divider-${item.key}`} className="flex items-center justify-center py-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ring-1 ring-slate-200/60 capitalize">
                          {item.label}
                        </span>
                      </div>
                    )
                  }
                  const message = item.message
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwnMessage={message.sender_id === user?.id}
                      authorInitials={otherInitials}
                    />
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="border-t border-slate-200 bg-white px-3 py-3 lg:px-5 lg:py-4"
          >
            <div className="mx-auto flex max-w-2xl items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholderText}
                rows={1}
                disabled={!selectedConversation || sending}
                className="min-h-[44px] max-h-[160px] resize-none rounded-2xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-relaxed focus-visible:border-primary focus-visible:bg-white"
              />
              <Button
                type="submit"
                disabled={!selectedConversation || sending || !draft.trim()}
                className="h-11 w-11 shrink-0 rounded-full bg-primary p-0 shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-40"
                aria-label="Envoyer"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mx-auto mt-1.5 max-w-2xl text-[10px] text-slate-400">
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">Entrée</kbd>{' '}
              pour envoyer ·{' '}
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">Shift</kbd>{' '}
              +{' '}
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">Entrée</kbd>{' '}
              pour un retour à la ligne
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function EmptyChatState({
  hasConversations,
  onBrowseClients,
}: {
  hasConversations: boolean
  onBrowseClients: () => void
}) {
  return (
    <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200/60">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <MessageSquare className="h-6 w-6 text-primary" />
      </div>
      <p className="text-base font-bold text-slate-900">
        {hasConversations ? 'Sélectionne une conversation' : 'Aucune conversation pour l\'instant'}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasConversations
          ? 'Choisis un client dans la liste pour reprendre la discussion.'
          : 'Quand un client t\'écrira, il apparaîtra à gauche.'}
      </p>
      {!hasConversations && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBrowseClients}
          className="mt-4 h-10 gap-1.5 rounded-xl border-primary/30 font-bold text-primary hover:bg-primary/5"
        >
          <Mail className="h-3.5 w-3.5" />
          Voir mes clients
        </Button>
      )}
    </div>
  )
}

function FirstMessageHint({
  clientName,
  onFocusInput,
}: {
  clientName: string
  onFocusInput: () => void
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Megaphone className="h-6 w-6 text-primary" />
      </div>
      <p className="text-base font-bold text-slate-900">Premier message à {clientName}</p>
      <p className="mt-1 text-sm text-slate-500">
        Encourage-le pour sa prochaine séance ou réponds à sa demande.
      </p>
      <Button
        size="sm"
        onClick={onFocusInput}
        className="mt-4 h-10 gap-1.5 rounded-xl bg-primary font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90"
      >
        <SendHorizonal className="h-3.5 w-3.5" />
        Écrire le premier message
      </Button>
    </div>
  )
}
