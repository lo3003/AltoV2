import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock4, MessageCircle } from 'lucide-react'

interface CoachHoursCardProps {
  totalHours: number | null
  remainingHours: number | null
  coachName: string | null
  loading?: boolean
}

const TICK_VALUES = [2, 4, 6, 8, 10]

const formatHours = (value: number) => {
  // Display "6h" if integer, else "6.5h"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1).replace(/\.0$/, '')}h`
}

export function CoachHoursCard({
  totalHours,
  remainingHours,
  coachName,
  loading = false,
}: CoachHoursCardProps) {
  const navigate = useNavigate()
  if (loading) {
    return (
      <Card className="border-border/40 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" />
        </CardContent>
      </Card>
    )
  }

  // No active package — invite the coach to set one up
  if (totalHours == null || totalHours <= 0) {
    return (
      <Card className="border-border/40 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
              <Clock4 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Pas de forfait actif</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {coachName
                  ? `Demande à ${coachName} d'enregistrer ton forfait pour suivre tes heures restantes.`
                  : "Demande à ton coach d'enregistrer ton forfait pour suivre tes heures restantes."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/client/coach')}
            className="h-10 shrink-0 gap-1.5 rounded-xl border-primary/30 font-bold text-primary hover:bg-primary/5"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Demander
          </Button>
        </CardContent>
      </Card>
    )
  }

  const safeRemaining = Math.max(remainingHours ?? totalHours, 0)
  const ratio = totalHours > 0 ? Math.min(safeRemaining / totalHours, 1) : 0
  // Reference scale grows to fit packages bigger than 10h
  const scaleMax = Math.max(10, Math.ceil(totalHours / 2) * 2)
  const fillRatio = scaleMax > 0 ? Math.min(safeRemaining / scaleMax, 1) : 0

  const visibleTicks = TICK_VALUES.filter((t) => t <= scaleMax)
  if (scaleMax > 10) {
    // Append a final tick for the package max if it's beyond 10
    if (!visibleTicks.includes(scaleMax)) visibleTicks.push(scaleMax)
  }

  const accent =
    ratio >= 0.5 ? 'text-emerald-600 bg-emerald-500' : ratio >= 0.2 ? 'text-amber-600 bg-amber-500' : 'text-rose-600 bg-rose-500'
  const [textColor, fillColor] = accent.split(' ')

  return (
    <Card className="border-border/40 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock4 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Heures restantes
            </p>
          </div>
          <p className="text-xs text-slate-500">
            sur <span className="font-semibold text-slate-700">{formatHours(totalHours)}</span>
          </p>
        </div>

        <p className="mt-4 text-2xl font-bold text-slate-900">
          Il te reste{' '}
          <span className={textColor}>{formatHours(safeRemaining)}</span>
          {coachName ? (
            <>
              {' '}avec <span className="text-slate-900">{coachName}</span>{' '}
              <span aria-hidden>!</span>
            </>
          ) : (
            ' !'
          )}
        </p>

        {/* Gauge */}
        <div className="mt-5">
          <div className="relative h-3 rounded-full bg-slate-100">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${fillColor} transition-all`}
              style={{ width: `${fillRatio * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {visibleTicks.map((tick) => (
              <span key={tick}>{tick}h</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
