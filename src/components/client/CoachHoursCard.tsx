import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt, MessageCircle, ChevronRight } from 'lucide-react'

interface CoachHoursCardProps {
  loading?: boolean
  enabled: boolean
  hasActivePackage: boolean
  totalSessions: number | null
  remainingSessions: number | null
  priceEur: number | null
  unitPriceEur: number | null
  purchasedAt: string | null
  coachName: string | null
}

const formatDateFr = (iso: string | null): string | null => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

export function CoachHoursCard({
  loading = false,
  enabled,
  hasActivePackage,
  totalSessions,
  remainingSessions,
  priceEur,
  unitPriceEur,
  purchasedAt,
  coachName,
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

  // Coach hasn't enabled the package system for this client.
  // (= séances offertes / pas de suivi à afficher)
  if (!enabled) {
    return null
  }

  // Enabled but no active package — invite the coach to set one up
  if (!hasActivePackage || totalSessions == null || totalSessions <= 0) {
    return (
      <Card className="border-border/40 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
              <Receipt className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Pas de forfait actif</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {coachName
                  ? `Demande à ${coachName} d'enregistrer ton prochain forfait pour suivre tes séances.`
                  : "Demande à ton coach d'enregistrer un forfait pour suivre tes séances."}
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

  const safeRemaining = Math.max(remainingSessions ?? totalSessions, 0)
  const ratio = totalSessions > 0 ? safeRemaining / totalSessions : 0
  const lowStock = safeRemaining <= 2 && safeRemaining > 0
  const empty = safeRemaining === 0

  const accentBar =
    empty ? 'bg-rose-500' : ratio >= 0.5 ? 'bg-emerald-500' : 'bg-amber-500'

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                <Receipt className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">
                Forfait en cours
              </p>
              {lowStock && (
                <Badge variant="secondary" className="bg-white/25 text-[10px] font-bold text-white">
                  Bientôt épuisé
                </Badge>
              )}
            </div>

            <p className="mt-3 text-4xl font-black leading-none">
              {safeRemaining}
              <span className="ml-1 text-xl font-bold opacity-75">/ {totalSessions}</span>
            </p>
            <p className="mt-1 text-sm font-semibold opacity-90">
              séance{safeRemaining > 1 ? 's' : ''} restante{safeRemaining > 1 ? 's' : ''}
              {coachName && <> avec {coachName}</>}
            </p>
          </div>

          {priceEur != null && (
            <div className="text-right">
              <p className="text-xl font-black">{Number(priceEur).toFixed(2)}€</p>
              {unitPriceEur != null && (
                <p className="text-[10px] font-semibold opacity-80">
                  {Number(unitPriceEur).toFixed(2)}€/séance
                </p>
              )}
            </div>
          )}
        </div>

        {/* Gauge */}
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className={`h-full rounded-full ${accentBar} transition-all`}
            style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-medium opacity-90">
          <span>{purchasedAt ? `Acheté le ${formatDateFr(purchasedAt)}` : ' '}</span>
          <button
            type="button"
            onClick={() => navigate('/client/stats')}
            className="inline-flex items-center gap-0.5 font-bold opacity-90 transition-opacity hover:opacity-100"
          >
            Voir l'historique
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
