import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClientFormInput } from '@/hooks/useCoachClients'

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: ClientFormInput) => Promise<void>
  isSubmitting: boolean
}

const INITIAL_FORM: ClientFormInput = {
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
}

export function AddClientDialog({ open, onOpenChange, onSubmit, isSubmitting }: AddClientDialogProps) {
  const [formData, setFormData] = useState<ClientFormInput>(INITIAL_FORM)

  useEffect(() => {
    if (open) {
      setFormData(INITIAL_FORM)
    }
  }, [open])

  const handleFieldChange = (field: keyof ClientFormInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold text-slate-900">Ajouter un client</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Renseignez les informations de base pour créer la fiche client.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-full-name">Nom / Prénom</Label>
              <Input
                id="add-full-name"
                value={formData.full_name}
                onChange={(event) => handleFieldChange('full_name', event.target.value)}
                placeholder="Ex: Julie Martin"
                className="h-10 rounded-xl border-slate-200 bg-white"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={formData.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                placeholder="Ex: julie@email.com (optionnel)"
                className="h-10 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-main-goal">Objectif principal</Label>
              <Input
                id="add-main-goal"
                value={formData.main_goal}
                onChange={(event) => handleFieldChange('main_goal', event.target.value)}
                placeholder="Ex: Perte de poids"
                className="h-10 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="add-height">Taille (cm)</Label>
                <Input
                  id="add-height"
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
                <Label htmlFor="add-weight">Poids (kg)</Label>
                <Input
                  id="add-weight"
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
                <Label htmlFor="add-fitness-level">Niveau</Label>
                <Select value={formData.fitness_level} onValueChange={(value) => handleFieldChange('fitness_level', value)}>
                  <SelectTrigger id="add-fitness-level" className="h-10 w-full rounded-xl border-slate-200 bg-white">
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
              <Label htmlFor="add-sporting-past">Passif sportif</Label>
              <Textarea
                id="add-sporting-past"
                value={formData.sporting_past}
                onChange={(event) => handleFieldChange('sporting_past', event.target.value)}
                placeholder="Sports pratiqués, expérience en salle..."
                className="min-h-20 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-available-equipment">Matériel à disposition</Label>
              <Textarea
                id="add-available-equipment"
                value={formData.available_equipment}
                onChange={(event) => handleFieldChange('available_equipment', event.target.value)}
                placeholder="Salle, haltères, tapis, élastiques..."
                className="min-h-20 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-physical-issues">Soucis physiques</Label>
              <Textarea
                id="add-physical-issues"
                value={formData.physical_issues}
                onChange={(event) => handleFieldChange('physical_issues', event.target.value)}
                placeholder="Blessures, douleurs, restrictions..."
                className="min-h-20 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="add-age">Âge</Label>
                <Input
                  id="add-age"
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
                <Label htmlFor="add-frequency">Séances / semaine</Label>
                <Input
                  id="add-frequency"
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
              disabled={isSubmitting}
              className="bg-[#10b981] font-bold text-white shadow-sm hover:bg-[#059669]"
            >
              {isSubmitting ? 'Création...' : 'Créer le client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
