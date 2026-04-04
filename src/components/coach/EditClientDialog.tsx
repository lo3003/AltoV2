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
})

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
      <DialogContent className="sm:max-w-xl rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold text-slate-900">Modifier les infos</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Mettez à jour les informations du client sélectionné.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-age">Âge</Label>
                <Input
                  id="edit-age"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.age}
                  onChange={(event) => handleFieldChange('age', event.target.value)}
                  placeholder="30"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
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
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-3xl border-slate-100 bg-slate-50/80 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !client}
              className="bg-[#10b981] font-bold text-white shadow-sm hover:bg-[#059669]"
            >
              {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
