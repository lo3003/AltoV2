import { useEffect, useMemo, useState } from 'react'
import { Calendar as CalendarIcon, CheckCircle2, Dumbbell, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

  // Auto-select the only program when there's exactly one
  useEffect(() => {
    if (open && programs.length === 1) {
      setSelectedProgramId(programs[0].id)
    }
  }, [open, programs])

  const canSubmit =
    Boolean(selectedDate) && Boolean(selectedProgramId) && programs.length > 0 && !isSubmitting

  const formattedDate = useMemo(() => {
    if (!selectedDate) return 'Date non sélectionnée'
    return formatLongDate(selectedDate)
  }, [selectedDate])

  const dayNumber = selectedDate?.getDate() ?? 0
  const monthShort = selectedDate
    ? selectedDate.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
    : ''

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
      <DialogContent className="sm:max-w-lg w-[95vw] rounded-3xl border-none p-0 shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Hero — date in big */}
          <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 pt-6 pb-5 text-white">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/90">
                  {monthShort}
                </span>
                <span className="text-2xl font-black leading-none">{dayNumber}</span>
              </div>
              <div className="min-w-0">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-xl font-black tracking-tight text-white">
                    Planifier une séance
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium text-white/80 capitalize">
                    {formattedDate}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
            {programs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 p-5 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-sm font-bold text-amber-800">Aucun programme assigné</p>
                <p className="mt-1 text-xs text-amber-700/80">
                  Assigne d'abord un programme à ce client depuis l'onglet « Programmes ».
                </p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Choisis un programme
                </p>

                <div className="space-y-2">
                  {programs.map((program) => {
                    const isSelected = selectedProgramId === program.id
                    return (
                      <button
                        key={program.id}
                        type="button"
                        onClick={() => setSelectedProgramId(program.id)}
                        className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
                          }`}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Dumbbell className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {program.name}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500">
                            {isSelected ? 'Sélectionné' : 'Appuyer pour sélectionner'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="mx-0 mb-0 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="h-11 rounded-xl font-bold"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-11 gap-1.5 rounded-xl bg-primary font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Planification…
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
