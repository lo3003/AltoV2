import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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

  const availablePrograms = useMemo(() => {
    const assignedSet = new Set(assignedProgramIds.map((id) => String(id)))
    return programs.filter((program) => !assignedSet.has(String(program.id)))
  }, [programs, assignedProgramIds])

  const resetForm = () => {
    setSelectedProgramId('')
    setStartDate('')
    setEndDate('')
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

    if (!startDate || !endDate) {
      toast.error('Veuillez définir les dates de début et de fin.')
      return
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('La date de fin doit être postérieure à la date de début.')
      return
    }

    await onSubmit({
      programId: selectedProgramId,
      startDate,
      endDate,
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
            {availablePrograms.length > 0 ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="assign-program">Programme</Label>
                  <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                    <SelectTrigger id="assign-program" className="h-10 w-full rounded-xl border-slate-200 bg-white">
                      <SelectValue placeholder="Choisir un programme..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePrograms.map((program) => (
                        <SelectItem key={String(program.id)} value={String(program.id)}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="assign-start-date">Date de début</Label>
                    <Input
                      id="assign-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="assign-end-date">Date de fin</Label>
                    <Input
                      id="assign-end-date"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                      required
                    />
                  </div>
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
              disabled={isSubmitting || availablePrograms.length === 0}
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
