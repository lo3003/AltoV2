import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ExternalSessionPayload } from '@/hooks/useClientStats'

const CATEGORIES = [
  'Renforcement musculaire',
  'Cardio',
  'Sports collectifs',
  'Course',
  'Marche',
  'Natation',
  'Vélo',
  'Yoga / Mobilité',
  'Autre',
]

interface AddExternalSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: ExternalSessionPayload) => Promise<void>
  saving?: boolean
}

const padTwo = (value: number) => String(value).padStart(2, '0')

const buildDefaultDateTimeLocal = () => {
  const now = new Date()
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}T${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`
}

export function AddExternalSessionDialog({
  open,
  onOpenChange,
  onSubmit,
  saving = false,
}: AddExternalSessionDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [duration, setDuration] = useState('')
  const [dateTime, setDateTime] = useState(() => buildDefaultDateTimeLocal())

  // Reset form whenever dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setCategory(CATEGORIES[0])
      setDuration('')
      setDateTime(buildDefaultDateTimeLocal())
    }
  }, [open])

  const isValid = useMemo(() => {
    const parsedDuration = Number(duration)
    return (
      name.trim().length > 0 &&
      Number.isFinite(parsedDuration) &&
      parsedDuration > 0 &&
      Boolean(dateTime)
    )
  }, [name, duration, dateTime])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsedDuration = Number(duration)
    if (!isValid) {
      toast.error('Vérifie que tous les champs sont remplis correctement.')
      return
    }

    try {
      // Convert local datetime-local string ("2026-04-27T18:30") to ISO with timezone
      const completedAt = new Date(dateTime).toISOString()
      await onSubmit({
        name: name.trim(),
        category,
        durationMinutes: parsedDuration,
        completedAt,
      })
      toast.success('Séance ajoutée à ton historique.')
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible d\'enregistrer la séance.'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une séance</DialogTitle>
          <DialogDescription>
            Enregistre une séance que tu as faite hors de l'application (course, natation, sport collectif…).
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="ext-session-name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Nom de la séance
            </Label>
            <Input
              id="ext-session-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Footing parc de la Tête d'Or"
              maxLength={120}
              disabled={saving}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ext-session-category" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Type d'activité
            </Label>
            <Select value={category} onValueChange={setCategory} disabled={saving}>
              <SelectTrigger id="ext-session-category" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ext-session-duration" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Durée (min)
              </Label>
              <Input
                id="ext-session-duration"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45"
                disabled={saving}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ext-session-datetime" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Date & heure
              </Label>
              <Input
                id="ext-session-datetime"
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                disabled={saving}
                className="h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!isValid || saving}>
              {saving ? 'Enregistrement…' : 'Ajouter la séance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
