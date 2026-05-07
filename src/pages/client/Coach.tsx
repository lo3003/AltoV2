import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Mail,
  Phone,
  MessageSquare,
  CalendarPlus,
  Dumbbell,
  HeartPulse,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClientProfile } from '@/hooks/useClientProfile'
import { useClientCoachInfo } from '@/hooks/useClientCoachInfo'
import { useClientMessaging } from '@/hooks/useClientMessaging'

const PROGRAM_TYPES = [
  { value: 'Renforcement', label: 'Renforcement musculaire', icon: Dumbbell },
  { value: 'Cardio', label: 'Cardio', icon: HeartPulse },
  { value: 'Mobilité', label: 'Mobilité / Étirement', icon: Sparkles },
]

const buildInitials = (name?: string | null) => {
  if (!name) return 'C'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ClientCoachPage() {
  const navigate = useNavigate()
  const { client, loading: clientLoading } = useClientProfile()
  const { coach, loading: coachLoading } = useClientCoachInfo(client?.id)
  const { sendMessage, sending } = useClientMessaging()

  const [rdvOpen, setRdvOpen] = useState(false)
  const [rdvNote, setRdvNote] = useState('')

  const [programOpen, setProgramOpen] = useState(false)
  const [programType, setProgramType] = useState(PROGRAM_TYPES[0].value)
  const [programNote, setProgramNote] = useState('')

  const initials = useMemo(() => buildInitials(coach?.fullName), [coach?.fullName])
  const loading = clientLoading || coachLoading

  const handleRequestRdv = async () => {
    try {
      const trimmedNote = rdvNote.trim()
      const body = trimmedNote
        ? `📅 Demande de RDV\n\n${trimmedNote}`
        : '📅 Demande de RDV\n\nPeux-tu me proposer un créneau pour une séance ? Merci !'
      await sendMessage(body)
      toast.success('Demande de RDV envoyée à ton coach.')
      setRdvOpen(false)
      setRdvNote('')
      navigate('/client/messages')
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'envoyer la demande."
      toast.error(message)
    }
  }

  const handleRequestProgram = async () => {
    try {
      const trimmedNote = programNote.trim()
      const typeLabel = PROGRAM_TYPES.find((t) => t.value === programType)?.label ?? programType
      const body = `📋 Demande de programme — ${typeLabel}\n\n${trimmedNote || 'Pas de précision particulière.'}`
      await sendMessage(body)
      toast.success('Demande de programme envoyée à ton coach.')
      setProgramOpen(false)
      setProgramNote('')
      navigate('/client/messages')
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'envoyer la demande."
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-0">
        <div className="h-8 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    )
  }

  if (!coach) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-base font-semibold text-slate-700">Aucun coach n'est encore associé à ton compte.</p>
            <p className="mt-2 text-sm text-slate-500">
              Demande à ton coach de t'envoyer un code client pour activer le lien.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 lg:space-y-6">
      <div>
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground lg:text-2xl">
          Mon Coach
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground lg:text-sm">
          Retrouve les coordonnées et raccourcis pour échanger rapidement avec ton coach.
        </p>
      </div>

      {/* Coach card — hero gradient on mobile for visual identity */}
      <div className="overflow-hidden rounded-3xl shadow-sm ring-1 ring-slate-200/60">
        {/* Banner with gradient */}
        <div className="relative bg-gradient-to-br from-primary via-emerald-500 to-emerald-600 px-5 py-6 text-white">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0 ring-2 ring-white/40 shadow-lg sm:h-20 sm:w-20">
              <AvatarImage src="" alt={coach.fullName ?? 'Coach'} />
              <AvatarFallback className="bg-white/20 text-lg font-extrabold text-white backdrop-blur">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">
                Pro Coach
              </p>
              <h2 className="mt-0.5 truncate text-xl font-black sm:text-2xl">
                {coach.fullName || 'Ton coach'}
              </h2>
              {coach.bio && (
                <p className="mt-1 line-clamp-2 text-xs text-white/85 leading-relaxed sm:text-sm">
                  {coach.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact rows */}
        <div className="grid gap-2 bg-white p-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
          <ContactRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={coach.email}
            href={coach.email ? `mailto:${coach.email}` : undefined}
          />
          <ContactRow
            icon={<Phone className="h-4 w-4" />}
            label="Téléphone"
            value={coach.phone}
            href={coach.phone ? `tel:${coach.phone.replace(/\s+/g, '')}` : undefined}
          />
        </div>
      </div>

      {/* Quick actions — single column on mobile, 3 cols on desktop */}
      <div className="space-y-2.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0">
        <ActionCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Envoyer un message"
          description="Discute en direct avec ton coach."
          onClick={() => navigate('/client/messages')}
        />
        <ActionCard
          icon={<CalendarPlus className="h-5 w-5" />}
          title="Demander un RDV"
          description="Propose un créneau pour ta prochaine séance."
          onClick={() => setRdvOpen(true)}
        />
        <ActionCard
          icon={<Dumbbell className="h-5 w-5" />}
          title="Demander un programme"
          description="Précise ton objectif (cardio, renfo…)."
          onClick={() => setProgramOpen(true)}
          accent
        />
      </div>

      {/* RDV dialog */}
      <Dialog open={rdvOpen} onOpenChange={setRdvOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander un rendez-vous</DialogTitle>
            <DialogDescription>
              Ton coach recevra ta demande dans la messagerie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rdv-note" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Précisions (optionnel)
            </Label>
            <Textarea
              id="rdv-note"
              value={rdvNote}
              onChange={(e) => setRdvNote(e.target.value)}
              placeholder="Ex: Disponible mardi soir et samedi matin."
              rows={3}
              maxLength={500}
              disabled={sending}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setRdvOpen(false)} disabled={sending}>
              Annuler
            </Button>
            <Button onClick={handleRequestRdv} disabled={sending}>
              {sending ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Programme request dialog */}
      <Dialog open={programOpen} onOpenChange={setProgramOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander un programme</DialogTitle>
            <DialogDescription>
              Choisis le type de programme et précise tes attentes — ton coach pourra te répondre directement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-type" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Type de programme
              </Label>
              <Select value={programType} onValueChange={setProgramType} disabled={sending}>
                <SelectTrigger id="program-type" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-note" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Annotation
              </Label>
              <Textarea
                id="program-note"
                value={programNote}
                onChange={(e) => setProgramNote(e.target.value)}
                placeholder="Ex: 30-45 min, niveau intermédiaire, pas de matériel."
                rows={4}
                maxLength={1000}
                disabled={sending}
              />
              <p className="text-[11px] text-slate-400">
                Plus tu précises (objectif, durée, matériel…), plus ton coach pourra adapter le programme.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setProgramOpen(false)} disabled={sending}>
              Annuler
            </Button>
            <Button onClick={handleRequestProgram} disabled={sending}>
              {sending ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  href?: string
}) {
  const hasValue = Boolean(value && value.trim())

  const content = (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">
          {hasValue ? value : <span className="text-slate-400 font-normal italic">Non renseigné</span>}
        </p>
      </div>
    </div>
  )

  if (hasValue && href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    )
  }

  return content
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  accent = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all hover:shadow-md sm:flex-col sm:items-start sm:gap-3 sm:p-4 ${
        accent
          ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
          : 'border-slate-200 bg-white hover:border-primary/30'
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
          accent ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 leading-relaxed sm:line-clamp-none">
          {description}
        </p>
      </div>
      <span className="text-slate-300 sm:hidden" aria-hidden>
        ›
      </span>
    </button>
  )
}

// Header card export so the page also exists as Card component if used elsewhere
export const _ClientCoachCard = Card
export const _ClientCoachCardHeader = CardHeader
export const _ClientCoachCardTitle = CardTitle
