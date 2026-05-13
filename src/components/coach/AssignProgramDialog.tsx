import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Program } from '@/hooks/useCoachPrograms'
import type { AssignProgramInput } from '@/hooks/useClientProgramAssignments'

interface AssignProgramDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programs: Program[]
  assignedProgramIds: Array<string | number>
  onSubmit: (payload: AssignProgramInput) => Promise<void>
  isSubmitting: boolean
}

export function AssignProgramDialog({
  open,
  onOpenChange,
  programs,
  assignedProgramIds,
  onSubmit,
  isSubmitting,
}: AssignProgramDialogProps) {
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [coachInstructions, setCoachInstructions] = useState('')
  const [alwaysAccessible, setAlwaysAccessible] = useState(false)

  // Show ALL programs (sorted by recent first) but mark the ones already
  // assigned to this client as disabled in the dropdown so the coach knows
  // they exist and why they can't be re-picked.
  const assignedSet = useMemo(
    () => new Set(assignedProgramIds.map((id) => String(id))),
    [assignedProgramIds]
  )

  const sortedPrograms = useMemo(() => {
    return [...programs].sort((a, b) => {
      // Programs not yet assigned bubble to the top
      const aAssigned = assignedSet.has(String(a.id))
      const bAssigned = assignedSet.has(String(b.id))
      if (aAssigned !== bAssigned) return aAssigned ? 1 : -1
      // Then most recent first
      const at = a.created_at || ''
      const bt = b.created_at || ''
      return bt.localeCompare(at)
    })
  }, [programs, assignedSet])

  const hasAtLeastOneAvailable = useMemo(
    () => sortedPrograms.some((program) => !assignedSet.has(String(program.id))),
    [sortedPrograms, assignedSet]
  )

  const resetForm = () => {
    setSelectedProgramId('')
    setStartDate('')
    setEndDate('')
    setCoachInstructions('')
    setAlwaysAccessible(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) resetForm()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedProgramId) {
      toast.error('Veuillez sélectionner un programme.')
      return
    }

    // For always-accessible programs, dates are optional. Fall back to today + 10y.
    let effectiveStartDate = startDate
    let effectiveEndDate = endDate
    if (alwaysAccessible) {
      if (!effectiveStartDate) effectiveStartDate = new Date().toISOString().slice(0, 10)
      if (!effectiveEndDate) {
        const tenYears = new Date()
        tenYears.setFullYear(tenYears.getFullYear() + 10)
        effectiveEndDate = tenYears.toISOString().slice(0, 10)
      }
    } else {
      if (!effectiveStartDate || !effectiveEndDate) {
        toast.error('Veuillez définir les dates de début et de fin.')
        return
      }
      if (new Date(effectiveEndDate) <= new Date(effectiveStartDate)) {
        toast.error('La date de fin doit être postérieure à la date de début.')
        return
      }
    }

    await onSubmit({
      programId: selectedProgramId,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      coachInstructions: coachInstructions.trim() || undefined,
      alwaysAccessible,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold text-slate-900">Assigner un programme existant</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Sélectionnez un programme et définissez sa période de validité.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            {sortedPrograms.length > 0 ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="assign-program">Programme</Label>
                  <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                    <SelectTrigger id="assign-program" className="h-10 w-full rounded-xl border-slate-200 bg-white">
                      <SelectValue placeholder="Choisir un programme..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedPrograms.map((program) => {
                        const alreadyAssigned = assignedSet.has(String(program.id))
                        return (
                          <SelectItem
                            key={String(program.id)}
                            value={String(program.id)}
                            disabled={alreadyAssigned}
                          >
                            <span className="flex items-center gap-2">
                              <span>{program.name}</span>
                              {alreadyAssigned && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  · déjà assigné
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {!hasAtLeastOneAvailable && (
                    <p className="text-xs text-amber-600">
                      Tous tes programmes sont déjà assignés à ce client. Désassigne d'abord un programme pour pouvoir en (ré)assigner un.
                    </p>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 transition-colors hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={alwaysAccessible}
                    onChange={(event) => setAlwaysAccessible(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#10b981] focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="flex flex-col text-sm">
                    <span className="font-bold text-slate-800">Toujours accessible</span>
                    <span className="text-xs text-slate-500">
                      Le programme reste épinglé en haut du dashboard du client, sans limite de date.
                      Idéal pour les routines (mobilité, etc.).
                    </span>
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="assign-start-date">
                      Date de début {alwaysAccessible && <span className="text-xs font-normal text-slate-400">(optionnelle)</span>}
                    </Label>
                    <Input
                      id="assign-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                      required={!alwaysAccessible}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="assign-end-date">
                      Date de fin {alwaysAccessible && <span className="text-xs font-normal text-slate-400">(optionnelle)</span>}
                    </Label>
                    <Input
                      id="assign-end-date"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                      required={!alwaysAccessible}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="assign-instructions">
                    Consigne pour ce client <span className="text-xs font-normal text-slate-400">(optionnel)</span>
                  </Label>
                  <Textarea
                    id="assign-instructions"
                    value={coachInstructions}
                    onChange={(event) => setCoachInstructions(event.target.value)}
                    placeholder="Ex: 3 séances/semaine, échauffement obligatoire 10 min, à adapter si douleur lombaire."
                    className="min-h-[88px] rounded-xl border-slate-200 bg-white"
                    maxLength={1000}
                  />
                  <p className="text-[11px] text-slate-400">
                    Cette consigne sera visible par le client dans l'aperçu de son programme.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Tous vos programmes sont déjà assignés à ce client, ou vous n'avez pas encore créé de programme.
              </div>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-3xl border-slate-100 bg-slate-50/80 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !hasAtLeastOneAvailable}
              className="bg-[#10b981] font-bold text-white shadow-sm hover:bg-[#059669]"
            >
              <CalendarIcon className="h-4 w-4" />
              {isSubmitting ? 'Assignation...' : 'Assigner le programme'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
