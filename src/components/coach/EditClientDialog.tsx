import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClientFormInput, CoachClient } from '@/hooks/useCoachClients'

interface EditClientDialogProps {
  open: boolean
  client: CoachClient | null
  onOpenChange: (open: boolean) => void
  onSubmit: (clientId: string, payload: ClientFormInput) => Promise<void>
  isSubmitting: boolean
}

const toFormInput = (client: CoachClient): ClientFormInput => ({
  full_name: client.full_name || '',
  email: client.email || '',
  main_goal: client.main_goal || '',
  height_cm: client.height_cm != null ? String(client.height_cm) : '',
  initial_weight_kg: client.initial_weight_kg != null ? String(client.initial_weight_kg) : '',
  fitness_level: client.fitness_level || 'Débutant',
  sporting_past: client.sporting_past || '',
  available_equipment: client.available_equipment || '',
  training_frequency: client.training_frequency || '',
  physical_issues: client.physical_issues || '',
  age: client.age != null ? String(client.age) : '',
  birth_date: client.birth_date || '',
})

// Compute age from a YYYY-MM-DD birth_date. Returns null if invalid.
function computeAgeFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null
  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const m = now.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

export function EditClientDialog({ open, client, onOpenChange, onSubmit, isSubmitting }: EditClientDialogProps) {
  const [formData, setFormData] = useState<ClientFormInput>({
    full_name: '',
    email: '',
    main_goal: '',
    height_cm: '',
    initial_weight_kg: '',
    fitness_level: 'Débutant',
    sporting_past: '',
    available_equipment: '',
    training_frequency: '',
    physical_issues: '',
    age: '',
    birth_date: '',
  })

  useEffect(() => {
    if (open && client) {
      setFormData(toFormInput(client))
    }
  }, [open, client])

  const handleFieldChange = (field: keyof ClientFormInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client) return
    await onSubmit(String(client.id), formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex flex-col gap-0 border-none p-0 shadow-xl
          fixed inset-0 left-0 top-0 max-w-none translate-x-0 translate-y-0 rounded-none h-[100dvh] w-full
          sm:fixed sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:overflow-hidden
        "
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col sm:max-h-[90vh]">
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pt-safe pb-3 sm:border-b-0 sm:px-6 sm:pb-0 sm:pt-6">
            <DialogTitle className="text-lg font-bold text-slate-900 sm:text-xl">Modifier les infos</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 sm:text-sm">
              Mettez à jour les informations du client sélectionné.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto grid gap-4 px-5 py-4 sm:px-6 custom-scrollbar">
            <div className="grid gap-2">
              <Label htmlFor="edit-full-name">Nom / Prénom</Label>
              <Input
                id="edit-full-name"
                value={formData.full_name}
                onChange={(event) => handleFieldChange('full_name', event.target.value)}
                placeholder="Ex: Julie Martin"
                className="h-10 rounded-xl border-slate-200 bg-white"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                placeholder="Ex: julie@email.com (optionnel)"
                className="h-10 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-main-goal">Objectif principal</Label>
              <Input
                id="edit-main-goal"
                value={formData.main_goal}
                onChange={(event) => handleFieldChange('main_goal', event.target.value)}
                placeholder="Ex: Perte de poids"
                className="h-10 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-height">Taille (cm)</Label>
                <Input
                  id="edit-height"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.height_cm}
                  onChange={(event) => handleFieldChange('height_cm', event.target.value)}
                  placeholder="170"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-weight">Poids (kg)</Label>
                <Input
                  id="edit-weight"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.initial_weight_kg}
                  onChange={(event) => handleFieldChange('initial_weight_kg', event.target.value)}
                  placeholder="70"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="edit-birth-date">
                  Date de naissance
                  {computeAgeFromBirthDate(formData.birth_date) !== null && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({computeAgeFromBirthDate(formData.birth_date)} ans)
                    </span>
                  )}
                </Label>
                <Input
                  id="edit-birth-date"
                  type="date"
                  value={formData.birth_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => handleFieldChange('birth_date', event.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-fitness-level">Niveau</Label>
                <Select value={formData.fitness_level} onValueChange={(value) => handleFieldChange('fitness_level', value)}>
                  <SelectTrigger id="edit-fitness-level" className="h-10 w-full rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Choisir un niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Débutant">Débutant</SelectItem>
                    <SelectItem value="Intermédiaire">Intermédiaire</SelectItem>
                    <SelectItem value="Avancé">Avancé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-frequency">Séances / semaine</Label>
                <Input
                  id="edit-frequency"
                  value={formData.training_frequency}
                  onChange={(event) => handleFieldChange('training_frequency', event.target.value)}
                  placeholder="3"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-sporting-past">Passif sportif</Label>
              <Textarea
                id="edit-sporting-past"
                value={formData.sporting_past}
                onChange={(event) => handleFieldChange('sporting_past', event.target.value)}
                placeholder="Sports pratiqués, expérience en salle..."
                className="min-h-20 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-available-equipment">Matériel à disposition</Label>
              <Textarea
                id="edit-available-equipment"
                value={formData.available_equipment}
                onChange={(event) => handleFieldChange('available_equipment', event.target.value)}
                placeholder="Salle, haltères, tapis, élastiques..."
                className="min-h-20 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-physical-issues">Soucis physiques</Label>
              <Textarea
                id="edit-physical-issues"
                value={formData.physical_issues}
                onChange={(event) => handleFieldChange('physical_issues', event.target.value)}
                placeholder="Blessures, douleurs, restrictions..."
                className="min-h-20 rounded-xl border-slate-200 bg-white"
              />
            </div>

          </div>

          <DialogFooter className="shrink-0 mx-0 mb-0 grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 pb-safe sm:flex sm:rounded-b-3xl sm:px-6 sm:py-4 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl font-bold sm:h-10 sm:font-semibold"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !client}
              className="h-11 rounded-xl bg-[#10b981] font-bold text-white shadow-sm hover:bg-[#059669] sm:h-10"
            >
              {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
