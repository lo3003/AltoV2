import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AddPackageSessionInput } from '@/hooks/useCoachPackages'

interface AddPackageSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageId: string | null
  remainingSessions: number | null
  onSubmit: (payload: AddPackageSessionInput) => Promise<void>
  saving: boolean
}

const SESSION_TYPES = [
  'Renforcement',
  'Cardio',
  'Mobilité',
  'Mixte',
  'Crossfit',
  'HIIT',
  'Yoga',
  'Autre',
] as const

const todayIso = () => new Date().toISOString().slice(0, 10)

export function AddPackageSessionDialog({
  open,
  onOpenChange,
  packageId,
  remainingSessions,
  onSubmit,
  saving,
}: AddPackageSessionDialogProps) {
  const [sessionDate, setSessionDate] = useState(todayIso())
  const [sessionType, setSessionType] = useState<string>('Mixte')
  const [duration, setDuration] = useState('60')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setSessionDate(todayIso())
      setSessionType('Mixte')
      setDuration('60')
      setNotes('')
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!packageId) {
      toast.error('Aucun forfait actif sélectionné.')
      return
    }
    if (!sessionDate) {
      toast.error('Veuillez saisir une date.')
      return
    }
    const durMin = Math.round(Number(duration))
    if (!Number.isFinite(durMin) || durMin <= 0) {
      toast.error('Durée invalide.')
      return
    }
    try {
      await onSubmit({
        packageId,
        sessionDate,
        sessionType: sessionType || 'Mixte',
        durationMin: durMin,
        notes: notes.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'enregistrer la séance."
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Cocher une séance
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {remainingSessions != null
                ? `${remainingSessions} séance${remainingSessions > 1 ? 's' : ''} restante${remainingSessions > 1 ? 's' : ''} avant cette saisie.`
                : "Saisis la séance qui vient d'avoir lieu en présentiel."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ps-date">Date de la séance</Label>
              <Input
                id="ps-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                max={todayIso()}
                className="h-10 rounded-xl border-slate-200 bg-white"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ps-type">Type d'entraînement</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger id="ps-type" className="h-10 w-full rounded-xl border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ps-duration">Durée (minutes)</Label>
              <Input
                id="ps-duration"
                type="number"
                min="15"
                max="360"
                step="5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-white"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ps-notes">
                Notes <span className="text-xs font-normal text-slate-400">(optionnel)</span>
              </Label>
              <Textarea
                id="ps-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Bonne séance, douleurs au lombaire..."
                className="min-h-[68px] rounded-xl border-slate-200 bg-white"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:rounded-b-3xl">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !packageId} className="bg-[#10b981] font-bold text-white hover:bg-[#059669]">
              {saving ? 'Enregistrement...' : 'Valider la séance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
