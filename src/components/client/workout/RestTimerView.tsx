import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, Minus, Plus, Pause, Play } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Convert "01:30" or "90s" or "1m30s" to seconds
const parseDuration = (input: string): number => {
  if (!input) return 60
  const trimmed = input.trim()
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':')
    return Math.max(0, parseInt(m, 10) * 60 + parseInt(s, 10))
  }
  const minMatch = trimmed.match(/(\d+)\s*m/i)
  const secMatch = trimmed.match(/(\d+)\s*s/i)
  let total = 0
  if (minMatch) total += parseInt(minMatch[1], 10) * 60
  if (secMatch) total += parseInt(secMatch[1], 10)
  if (total > 0) return total
  const parsed = parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60).toString().padStart(2, '0')
  const s = (safe % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

interface RestTimerViewProps {
  duration: string
  nextExerciseName: string
  nextSetIndicator: string
  nextExercisePhotoUrl?: string | null
  onComplete: () => void
  onSkip: () => void
}

export function RestTimerView({
  duration,
  nextExerciseName,
  nextSetIndicator,
  onComplete,
  onSkip,
}: RestTimerViewProps) {
  const initialDuration = useMemo(() => parseDuration(duration), [duration])
  const [totalDuration, setTotalDuration] = useState(initialDuration)
  const [timeLeft, setTimeLeft] = useState(initialDuration)
  const [isPaused, setIsPaused] = useState(false)
  const completedRef = useRef(false)

  // Reset whenever the parent passes a new duration
  useEffect(() => {
    setTotalDuration(initialDuration)
    setTimeLeft(initialDuration)
    setIsPaused(false)
    completedRef.current = false
  }, [initialDuration])

  // Tick
  useEffect(() => {
    if (isPaused) return
    if (timeLeft <= 0) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const id = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(id)
  }, [timeLeft, isPaused, onComplete])

  const adjust = (delta: number) => {
    setTimeLeft((prev) => Math.max(0, prev + delta))
    setTotalDuration((prev) => Math.max(prev, Math.max(1, timeLeft + delta)))
  }

  const progress = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0

  // SVG circle
  const radius = 120
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const accentColor = timeLeft <= 5 ? '#f59e0b' : '#10b981'
  const isUrgent = timeLeft <= 5 && timeLeft > 0

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-b from-emerald-50 via-white to-white px-6 pt-safe pb-safe">
      {/* Top label */}
      <div className="mt-8 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-600">
          Récupération
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Repos prévu : {formatTime(totalDuration)}
        </p>
      </div>

      {/* Big circular timer */}
      <div className="relative flex flex-1 items-center justify-center">
        <div className={`relative w-full max-w-[300px] aspect-square ${isUrgent ? 'animate-pulse' : ''}`}>
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 280 280">
            <circle
              cx="140"
              cy="140"
              r={radius}
              className="stroke-slate-100"
              strokeWidth="14"
              fill="none"
            />
            <circle
              cx="140"
              cy="140"
              r={radius}
              stroke={accentColor}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[64px] font-black tracking-tighter tabular-nums leading-none"
              style={{ color: accentColor }}
            >
              {formatTime(timeLeft)}
            </span>
            <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {isPaused ? 'En pause' : 'Temps restant'}
            </span>
          </div>
        </div>
      </div>

      {/* Adjust controls */}
      <div className="mb-5 flex items-center justify-center gap-2.5">
        <Button
          variant="outline"
          onClick={() => adjust(-15)}
          disabled={timeLeft <= 0}
          className="h-11 px-4 rounded-2xl bg-white border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Minus className="h-3.5 w-3.5" />
          15s
        </Button>

        <Button
          variant="outline"
          onClick={() => setIsPaused((p) => !p)}
          className="h-11 w-11 rounded-2xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label={isPaused ? 'Reprendre' : 'Pause'}
        >
          {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
        </Button>

        <Button
          variant="outline"
          onClick={() => adjust(15)}
          className="h-11 px-4 rounded-2xl bg-white border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          15s
        </Button>
      </div>

      {/* Next exercise card */}
      <div className="mb-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200/70 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          À suivre
        </p>
        <p className="mt-1 text-lg font-black text-slate-900 truncate">
          {nextExerciseName}
        </p>
        <p className="mt-0.5 text-xs font-bold text-emerald-600">
          {nextSetIndicator}
        </p>
      </div>

      {/* Skip CTA */}
      <Button
        onClick={onSkip}
        className="h-14 w-full rounded-2xl bg-emerald-500 text-base font-extrabold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600"
      >
        Passer le repos
        <ChevronRight className="ml-1 h-5 w-5" />
      </Button>
    </div>
  )
}
