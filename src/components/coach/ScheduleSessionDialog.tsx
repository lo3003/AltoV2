import { useMemo, useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface ScheduleProgramOption {
  id: string
  name: string
}

interface ScheduleSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date | null
  programs: ScheduleProgramOption[]
  isSubmitting: boolean
  onSubmit: (payload: { programId: string }) => Promise<void>
}

const formatLongDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  selectedDate,
  programs,
  isSubmitting,
  onSubmit,
}: ScheduleSessionDialogProps) {
  const [selectedProgramId, setSelectedProgramId] = useState('')

  const canSubmit = Boolean(selectedDate) && Boolean(selectedProgramId) && programs.length > 0 && !isSubmitting

  const formattedDate = useMemo(() => {
    if (!selectedDate) return 'Date non sélectionnée'
    return formatLongDate(selectedDate)
  }, [selectedDate])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setSelectedProgramId('')
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedDate) {
      toast.error('Veuillez sélectionner une date.')
      return
    }

    if (!selectedProgramId) {
      toast.error('Veuillez sélectionner un programme.')
      return
    }

    await onSubmit({ programId: selectedProgramId })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-bold text-slate-900">Planifier une séance</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Choisissez un programme assigné à ce client pour la date sélectionnée.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Date sélectionnée</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formattedDate}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-program">Programme</Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger id="schedule-program" className="h-10 w-full rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder={programs.length > 0 ? 'Choisir un programme...' : 'Aucun programme assigné'} />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {programs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                Aucun programme assigné disponible. Assignez d'abord un programme dans l'onglet Programmes.
              </div>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-3xl border-slate-100 bg-slate-50/80 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-[#10b981] font-bold text-white shadow-sm hover:bg-[#059669]"
            >
              <CalendarIcon className="h-4 w-4" />
              {isSubmitting ? 'Planification...' : 'Valider la séance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
