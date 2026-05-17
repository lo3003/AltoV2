import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Receipt } from 'lucide-react'
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
import type { CreatePackageInput, PackagePricePreset } from '@/hooks/useCoachPackages'

interface CreatePackageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presets: PackagePricePreset[]
  onSubmit: (payload: CreatePackageInput) => Promise<void>
  saving: boolean
  clientName?: string | null
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function CreatePackageDialog({
  open,
  onOpenChange,
  presets,
  onSubmit,
  saving,
  clientName,
}: CreatePackageDialogProps) {
  const [sessions, setSessions] = useState('10')
  const [price, setPrice] = useState('225')
  const [purchasedAt, setPurchasedAt] = useState(todayIso())
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      // Pré-remplir avec le preset le plus avantageux (le plus de séances)
      const richest = [...presets].sort((a, b) => b.sessions - a.sessions)[0]
      if (richest) {
        setSessions(String(richest.sessions))
        setPrice(String(richest.price))
      }
      setPurchasedAt(todayIso())
      setNotes('')
    }
  }, [open, presets])

  const unitPrice = useMemo(() => {
    const s = Number(sessions)
    const p = Number(price)
    if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(p) || p < 0) return null
    return (p / s).toFixed(2)
  }, [sessions, price])

  const handlePresetClick = (preset: PackagePricePreset) => {
    setSessions(String(preset.sessions))
    setPrice(String(preset.price))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const totalSessions = Math.round(Number(sessions))
    const priceEur = Number(price)
    if (!Number.isFinite(totalSessions) || totalSessions <= 0) {
      toast.error('Veuillez saisir un nombre de séances valide.')
      return
    }
    if (!Number.isFinite(priceEur) || priceEur < 0) {
      toast.error('Veuillez saisir un prix valide.')
      return
    }
    if (!purchasedAt) {
      toast.error("Veuillez sélectionner la date d'achat.")
      return
    }
    try {
      await onSubmit({
        totalSessions,
        priceEur: Number(priceEur.toFixed(2)),
        purchasedAt,
        notes: notes.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer le forfait.'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Receipt className="h-5 w-5 text-primary" />
              Encoder un forfait
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {clientName
                ? `Saisis le forfait acheté par ${clientName}.`
                : 'Saisis le nombre de séances et le prix payé.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            {presets.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Presets
                </Label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={`${preset.sessions}-${preset.price}`}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      {preset.sessions} séance{preset.sessions > 1 ? 's' : ''} · {preset.price}€
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pkg-sessions">Nombre de séances</Label>
                <Input
                  id="pkg-sessions"
                  type="number"
                  min="1"
                  step="1"
                  value={sessions}
                  onChange={(e) => setSessions(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pkg-price">Prix total (€)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white"
                  required
                />
              </div>
            </div>

            {unitPrice && (
              <p className="text-xs text-slate-500">
                Soit <span className="font-semibold text-slate-700">{unitPrice}€</span> par séance.
              </p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="pkg-purchased">Date d'achat</Label>
              <Input
                id="pkg-purchased"
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                max={todayIso()}
                className="h-10 rounded-xl border-slate-200 bg-white"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pkg-notes">
                Notes <span className="text-xs font-normal text-slate-400">(optionnel)</span>
              </Label>
              <Textarea
                id="pkg-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Payé en 2 fois, virement reçu le 15/04..."
                className="min-h-[68px] rounded-xl border-slate-200 bg-white"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:rounded-b-3xl">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#10b981] font-bold text-white hover:bg-[#059669]">
              {saving ? 'Enregistrement...' : 'Créer le forfait'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
