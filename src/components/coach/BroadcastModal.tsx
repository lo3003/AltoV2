import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { CoachClient } from '@/hooks/useCoachClients'

interface BroadcastModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: CoachClient[]
  onSend: (receiverIds: string[], content: string) => Promise<number>
}

export function BroadcastModal({ open, onOpenChange, clients, onSend }: BroadcastModalProps) {
  const [selectedReceiverIds, setSelectedReceiverIds] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  const selectableClients = useMemo(() => {
    return clients.filter((client) => Boolean(client.auth_user_id))
  }, [clients])

  const allSelected = selectableClients.length > 0 && selectedReceiverIds.length === selectableClients.length

  const toggleClient = (receiverId: string) => {
    setSelectedReceiverIds((prev) =>
      prev.includes(receiverId)
        ? prev.filter((id) => id !== receiverId)
        : [...prev, receiverId]
    )
  }

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedReceiverIds([])
      return
    }

    setSelectedReceiverIds(selectableClients.map((client) => String(client.auth_user_id)))
  }

  const resetState = () => {
    setSelectedReceiverIds([])
    setContent('')
  }

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }

  const handleSend = async () => {
    const cleanContent = content.trim()

    if (selectedReceiverIds.length === 0) {
      toast.error('Sélectionnez au moins un client.')
      return
    }

    if (!cleanContent) {
      toast.error('Le message est vide.')
      return
    }

    setSending(true)
    try {
      const sentCount = await onSend(selectedReceiverIds, cleanContent)
      toast.success(`Message envoyé à ${sentCount} client(s) !`)
      handleClose(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'envoi du message.'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl border-none bg-slate-950 text-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Message groupé</DialogTitle>
          <DialogDescription className="text-slate-400">
            Sélectionne les clients, puis envoie un message en une seule action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {selectedReceiverIds.length}/{selectableClients.length} sélectionné(s)
            </p>
            <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-slate-800" onClick={handleToggleAll}>
              {allSelected ? 'Tout désélectionner' : 'Sélectionner tout'}
            </Button>
          </div>

          <ScrollArea className="h-56 rounded-xl border border-slate-800 bg-slate-900 p-2">
            <div className="space-y-1.5">
              {selectableClients.map((client) => {
                const receiverId = String(client.auth_user_id)
                const isChecked = selectedReceiverIds.includes(receiverId)
                const initials = client.full_name
                  ? client.full_name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()
                  : 'CL'

                return (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-800"
                  >
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleClient(receiverId)} />
                    <Avatar className="h-7 w-7 border border-slate-700">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-slate-700 text-[10px] text-white">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{client.full_name || client.email}</p>
                      <p className="truncate text-[11px] text-slate-400">{client.email}</p>
                    </div>
                  </label>
                )
              })}

              {selectableClients.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-slate-400">
                  Aucun client activé (auth_user_id manquant).
                </p>
              )}
            </div>
          </ScrollArea>

          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Écris ton message à envoyer au groupe..."
            className="min-h-28 border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <DialogFooter className="border-slate-800 bg-slate-950">
          <Button variant="outline" onClick={() => handleClose(false)} className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800">
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {sending ? 'Envoi...' : `Envoyer à ${selectedReceiverIds.length || 0} client(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
