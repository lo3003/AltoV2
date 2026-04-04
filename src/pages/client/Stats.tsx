import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Scale, TrendingDown, TrendingUp, CalendarDays, Trophy, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useClientProfile } from '@/hooks/useClientProfile'
import { useClientStats } from '@/hooks/useClientStats'

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ClientStatsPage() {
  const { client, loading: clientLoading } = useClientProfile()
  const {
    loading,
    savingWeight,
    tableReady,
    weeklyWeightPoints,
    thisWeekSessions,
    thisMonthSessions,
    latestProgramTitle,
    addWeightLog,
    error,
  } = useClientStats(client?.id)

  const [weightInput, setWeightInput] = useState('')
  const [dateInput, setDateInput] = useState(toDateInputValue(new Date()))

  const latestPoint = weeklyWeightPoints[weeklyWeightPoints.length - 1] || null
  const previousPoint = weeklyWeightPoints.length > 1 ? weeklyWeightPoints[weeklyWeightPoints.length - 2] : null

  const trend = useMemo(() => {
    if (!latestPoint || !previousPoint) return null

    const delta = Number((latestPoint.weightKg - previousPoint.weightKg).toFixed(2))
    if (delta === 0) return { direction: 'stable' as const, delta }
    if (delta < 0) return { direction: 'down' as const, delta }
    return { direction: 'up' as const, delta }
  }, [latestPoint, previousPoint])

  const handleSubmitWeight = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsedWeight = Number(weightInput)
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast.error('Veuillez saisir un poids valide en kg.')
      return
    }

    if (!dateInput) {
      toast.error('Veuillez sélectionner une date.')
      return
    }

    try {
      await addWeightLog({
        weightKg: Number(parsedWeight.toFixed(2)),
        measuredAt: dateInput,
      })

      toast.success('Poids enregistré avec succès.')
      setWeightInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible d\'enregistrer le poids.'
      toast.error(message)
    }
  }

  if (clientLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">Statistiques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi de ton poids et de ton activité réelle.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Séances cette semaine"
          value={String(thisWeekSessions)}
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          subtitle="séances réalisées"
        />
        <StatsCard
          title="Séances ce mois"
          value={String(thisMonthSessions)}
          icon={<Trophy className="h-4 w-4 text-primary" />}
          subtitle="séances réalisées"
        />
        <StatsCard
          title="Dernier programme"
          value={latestProgramTitle || '—'}
          icon={<Target className="h-4 w-4 text-primary" />}
          subtitle="programme complété"
          compact
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="border-border/40 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" />
              Encoder mon poids
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!tableReady && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Le suivi poids n'est pas encore activé (migration SQL requise).
              </div>
            )}

            <form className="space-y-3" onSubmit={handleSubmitWeight}>
              <div className="space-y-1.5">
                <label htmlFor="weight-input" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Poids (kg)
                </label>
                <Input
                  id="weight-input"
                  type="number"
                  min="1"
                  step="0.1"
                  value={weightInput}
                  onChange={(event) => setWeightInput(event.target.value)}
                  placeholder="Ex: 76.4"
                  className="h-11"
                  disabled={!tableReady || savingWeight}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="weight-date" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Date de mesure
                </label>
                <Input
                  id="weight-date"
                  type="date"
                  value={dateInput}
                  onChange={(event) => setDateInput(event.target.value)}
                  className="h-11"
                  disabled={!tableReady || savingWeight}
                />
              </div>

              <Button type="submit" className="w-full font-semibold" disabled={!tableReady || savingWeight}>
                {savingWeight ? 'Enregistrement...' : 'Enregistrer le poids'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Évolution du poids</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weeklyWeightPoints.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune donnée de poids pour le moment.
              </div>
            ) : (
              weeklyWeightPoints.map((point) => {
                const maxWeight = Math.max(...weeklyWeightPoints.map((entry) => entry.weightKg), 1)
                const width = Math.max((point.weightKg / maxWeight) * 100, 8)

                return (
                  <div key={point.weekStart} className="rounded-xl border border-slate-100 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">{point.weekLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{point.weightKg.toFixed(1)} kg</span>
                        {point.deltaKg != null && (
                          <Badge
                            variant="outline"
                            className={
                              point.deltaKg < 0
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : point.deltaKg > 0
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                            }
                          >
                            {point.deltaKg > 0 ? '+' : ''}{point.deltaKg.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })
            )}

            {trend && (
              <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-primary">
                <div className="flex items-center gap-2 font-semibold">
                  {trend.direction === 'down' ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : trend.direction === 'up' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Scale className="h-4 w-4" />
                  )}
                  {trend.direction === 'down'
                    ? `Tu as perdu ${Math.abs(trend.delta)} kg depuis la semaine précédente.`
                    : trend.direction === 'up'
                      ? `Tu as pris ${trend.delta} kg depuis la semaine précédente.`
                      : 'Poids stable par rapport à la semaine précédente.'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Graphique du poids</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightLineChart
            points={weeklyWeightPoints.map((point) => ({
              label: point.weekLabel,
              value: point.weightKg,
            }))}
          />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

function StatsCard({
  title,
  value,
  subtitle,
  icon,
  compact = false,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  compact?: boolean
}) {
  return (
    <Card className="border-border/40 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">{icon}</div>
        </div>
        <p className={compact ? 'text-base font-bold text-slate-900 line-clamp-1' : 'text-3xl font-bold text-slate-900'}>
          {value}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function WeightLineChart({
  points,
}: {
  points: Array<{ label: string; value: number }>
}) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Ajoute au moins 2 mesures pour afficher le graphique en ligne.
      </div>
    )
  }

  const width = 1200
  const height = 320
  const padding = { top: 24, right: 32, bottom: 42, left: 44 }

  const minValue = Math.min(...points.map((point) => point.value))
  const maxValue = Math.max(...points.map((point) => point.value))
  const valueRange = Math.max(maxValue - minValue, 0.5)

  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const coordinates = points.map((point, index) => {
    const x = padding.left + (index / (points.length - 1)) * plotWidth
    const y = padding.top + ((maxValue - point.value) / valueRange) * plotHeight
    return { x, y, ...point }
  })

  const linePath = coordinates
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} L ${coordinates[0].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`

  const yTicks = [maxValue, minValue + valueRange / 2, minValue]

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Graphique du poids</p>
        <p className="text-xs text-slate-500">12 dernières semaines max</p>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full lg:h-[320px]">
          {yTicks.map((tick) => {
            const y = padding.top + ((maxValue - tick) / valueRange) * plotHeight
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-medium"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            )
          })}

          <path d={areaPath} fill="currentColor" className="text-primary/10" />
          <path d={linePath} fill="none" stroke="currentColor" className="text-primary" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

          {coordinates.map((coord) => (
            <g key={`${coord.label}-${coord.x}`}>
              <circle cx={coord.x} cy={coord.y} r={5} fill="white" stroke="currentColor" className="text-primary" strokeWidth={2.5} />
            </g>
          ))}

          {coordinates.map((coord, index) => {
            const shouldLabel = index === 0 || index === coordinates.length - 1 || index === Math.floor((coordinates.length - 1) / 2)
            if (!shouldLabel) return null

            const shortLabel = coord.label.split(' - ')[0] || coord.label
            return (
              <text
                key={`label-${coord.x}`}
                x={coord.x}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-medium"
              >
                {shortLabel}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
