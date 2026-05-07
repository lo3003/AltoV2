import { useEffect, useMemo, useRef, useState } from 'react'
import { Timer, Repeat2, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { WorkoutExerciseBlock, WorkoutExecutionMode } from '@/hooks/useActiveWorkout'

interface GroupedExerciseRunnerProps {
  mode: WorkoutExecutionMode
  block: WorkoutExerciseBlock
  currentRound: number
  currentExerciseInBlockIndex: number
  onCompleteTimedBlock: () => void
  onSetTimedExerciseIndex: (index: number) => void
}

interface CircularTimerProps {
  title: string
  subtitle: string
  secondsLeft: number
  totalSeconds: number
  accentClassName?: string
}

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const formatTimer = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0')
  const remainingSeconds = (safe % 60).toString().padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

const getGroupLabel = (mode: WorkoutExecutionMode, count: number) => {
  if (mode === 'Superset') {
    if (count >= 4) return 'Circuit'
    if (count === 3) return 'Triset'
    return 'Superset'
  }
  return mode
}

const vibratePulse = () => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(120)
  }
}

function CircularTimer({ title, subtitle, secondsLeft, totalSeconds, accentClassName = 'text-[#10b981]' }: CircularTimerProps) {
  const radius = 96
  const circumference = 2 * Math.PI * radius
  const safeTotal = Math.max(1, totalSeconds)
  const progress = Math.max(0, Math.min(1, secondsLeft / safeTotal))
  const strokeDashoffset = circumference - progress * circumference

  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
      <div className="text-center">
        <p className={`text-xs font-black uppercase tracking-wider ${accentClassName}`}>{title}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>

      <div className="mx-auto mt-4 flex h-56 w-56 items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 240 240">
          <circle cx="120" cy="120" r={radius} className="stroke-slate-100" strokeWidth="14" fill="none" />
          <circle
            cx="120"
            cy="120"
            r={radius}
            className="stroke-[#10b981] transition-all duration-1000 ease-linear"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
          />
        </svg>

        <div className="pointer-events-none absolute text-center">
          <p className="text-4xl font-black tracking-tight text-slate-900">{formatTimer(secondsLeft)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Temps restant</p>
        </div>
      </div>
    </div>
  )
}

export function GroupedExerciseRunner({
  mode,
  block,
  currentRound,
  currentExerciseInBlockIndex,
  onCompleteTimedBlock,
  onSetTimedExerciseIndex,
}: GroupedExerciseRunnerProps) {
  const completedRef = useRef(false)

  const [amrapSecondsLeft, setAmrapSecondsLeft] = useState(0)
  const [amrapTours, setAmrapTours] = useState(0)

  const [emomMinuteSecondsLeft, setEmomMinuteSecondsLeft] = useState(60)
  const [emomCurrentMinute, setEmomCurrentMinute] = useState(1)
  const [emomTotalMinutes, setEmomTotalMinutes] = useState(1)
  const [emomDoneThisMinute, setEmomDoneThisMinute] = useState(false)

  const [tabataPhase, setTabataPhase] = useState<'work' | 'rest'>('work')
  const [tabataRound, setTabataRound] = useState(1)
  const [tabataSecondsLeft, setTabataSecondsLeft] = useState(20)
  const [tabataWorkSeconds, setTabataWorkSeconds] = useState(20)
  const [tabataRestSeconds, setTabataRestSeconds] = useState(10)

  const blockLabel = useMemo(() => getGroupLabel(mode, block.exercises.length), [mode, block.exercises.length])

  useEffect(() => {
    completedRef.current = false

    if (mode === 'AMRAP') {
      const firstExercise = block.exercises[0]
      const durationMinutes = toPositiveInt(firstExercise?.amrap_duration, 12)
      const totalSeconds = durationMinutes * 60

      setAmrapSecondsLeft(totalSeconds)
      setAmrapTours(0)
      onSetTimedExerciseIndex(0)
    }

    if (mode === 'EMOM') {
      const firstExercise = block.exercises[0]
      const totalMinutes = toPositiveInt(firstExercise?.amrap_duration, Math.max(1, block.rounds))

      setEmomTotalMinutes(totalMinutes)
      setEmomCurrentMinute(1)
      setEmomMinuteSecondsLeft(60)
      setEmomDoneThisMinute(false)
      onSetTimedExerciseIndex(0)
    }

    if (mode === 'Tabata') {
      const firstExercise = block.exercises[0]
      const workSeconds = toPositiveInt(firstExercise?.tabata_work, 20)
      const restSeconds = toPositiveInt(firstExercise?.tabata_rest, 10)

      setTabataWorkSeconds(workSeconds)
      setTabataRestSeconds(restSeconds)
      setTabataRound(1)
      setTabataPhase('work')
      setTabataSecondsLeft(workSeconds)
      onSetTimedExerciseIndex(0)
    }
  }, [block.id, block.exercises, block.rounds, mode, onSetTimedExerciseIndex])

  useEffect(() => {
    if (mode !== 'AMRAP') return
    if (amrapSecondsLeft <= 0) {
      if (!completedRef.current) {
        completedRef.current = true
        vibratePulse()
        onCompleteTimedBlock()
      }
      return
    }

    const interval = window.setInterval(() => {
      setAmrapSecondsLeft((prev) => prev - 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [amrapSecondsLeft, mode, onCompleteTimedBlock])

  useEffect(() => {
    if (mode !== 'EMOM') return
    if (completedRef.current) return

    if (emomCurrentMinute > emomTotalMinutes) {
      completedRef.current = true
      vibratePulse()
      onCompleteTimedBlock()
      return
    }

    if (emomMinuteSecondsLeft <= 0) {
      vibratePulse()
      setEmomCurrentMinute((prev) => prev + 1)
      setEmomMinuteSecondsLeft(60)
      setEmomDoneThisMinute(false)
      onSetTimedExerciseIndex(emomCurrentMinute % block.exercises.length)
      return
    }

    const interval = window.setInterval(() => {
      setEmomMinuteSecondsLeft((prev) => prev - 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [
    block.exercises.length,
    emomCurrentMinute,
    emomMinuteSecondsLeft,
    emomTotalMinutes,
    mode,
    onCompleteTimedBlock,
    onSetTimedExerciseIndex,
  ])

  useEffect(() => {
    if (mode !== 'Tabata') return
    if (completedRef.current) return

    if (tabataSecondsLeft <= 0) {
      vibratePulse()

      if (tabataPhase === 'work') {
        if (tabataRound >= block.rounds) {
          completedRef.current = true
          onCompleteTimedBlock()
          return
        }

        setTabataPhase('rest')
        setTabataSecondsLeft(tabataRestSeconds)
        return
      }

      const nextRound = tabataRound + 1
      setTabataRound(nextRound)
      setTabataPhase('work')
      setTabataSecondsLeft(tabataWorkSeconds)
      onSetTimedExerciseIndex((nextRound - 1) % block.exercises.length)
      return
    }

    const interval = window.setInterval(() => {
      setTabataSecondsLeft((prev) => prev - 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [
    block.exercises.length,
    block.rounds,
    mode,
    onCompleteTimedBlock,
    onSetTimedExerciseIndex,
    tabataPhase,
    tabataRestSeconds,
    tabataRound,
    tabataSecondsLeft,
    tabataWorkSeconds,
  ])

  if (mode === 'AMRAP') {
    const totalSeconds = toPositiveInt(block.exercises[0]?.amrap_duration, 12) * 60

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#10b981]/10 text-[#10b981] border-none">AMRAP</Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none">
            Tours complétés: {amrapTours}
          </Badge>
        </div>

        <CircularTimer
          title="AMRAP"
          subtitle={`Enchaîne les exercices librement • ${block.exercises.length} exercices`}
          secondsLeft={amrapSecondsLeft}
          totalSeconds={totalSeconds}
        />

        <Button
          type="button"
          onClick={() => {
            setAmrapTours((prev) => prev + 1)
            onSetTimedExerciseIndex((currentExerciseInBlockIndex + 1) % block.exercises.length)
          }}
          className="h-14 w-full rounded-2xl bg-[#10b981] text-base font-bold text-white hover:bg-[#059669]"
        >
          <Repeat2 className="h-4 w-4" />
          Tour terminé
        </Button>
      </div>
    )
  }

  if (mode === 'EMOM') {
    const subtitle = `Minute ${Math.min(emomCurrentMinute, emomTotalMinutes)}/${emomTotalMinutes}`

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#10b981]/10 text-[#10b981] border-none">EMOM</Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none">
            {subtitle}
          </Badge>
        </div>

        <CircularTimer
          title="EMOM"
          subtitle="Le temps restant dans la minute devient ton repos"
          secondsLeft={emomMinuteSecondsLeft}
          totalSeconds={60}
        />

        <Button
          type="button"
          onClick={() => setEmomDoneThisMinute(true)}
          disabled={emomDoneThisMinute}
          className="h-14 w-full rounded-2xl bg-[#10b981] text-base font-bold text-white hover:bg-[#059669] disabled:opacity-60"
        >
          <ListOrdered className="h-4 w-4" />
          {emomDoneThisMinute ? 'Exercice fait, attends la minute suivante' : 'Fait'}
        </Button>
      </div>
    )
  }

  if (mode === 'Tabata') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#10b981]/10 text-[#10b981] border-none">Tabata</Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none">
            Round {tabataRound}/{Math.max(1, block.rounds)}
          </Badge>
          <Badge className={tabataPhase === 'work' ? 'bg-emerald-100 text-emerald-700 border-none' : 'bg-amber-100 text-amber-700 border-none'}>
            {tabataPhase === 'work' ? 'WORK' : 'REPOS'}
          </Badge>
        </div>

        <CircularTimer
          title={tabataPhase === 'work' ? 'Phase active' : 'Phase repos'}
          subtitle={`${block.exercises.length} exercice(s) en rotation`}
          secondsLeft={tabataSecondsLeft}
          totalSeconds={tabataPhase === 'work' ? tabataWorkSeconds : tabataRestSeconds}
          accentClassName={tabataPhase === 'work' ? 'text-[#10b981]' : 'text-amber-600'}
        />
      </div>
    )
  }

  const contextText = block.exercises.length > 1
    ? `${blockLabel} ${currentRound}/${Math.max(1, block.rounds)} • Exercice ${currentExerciseInBlockIndex + 1}/${block.exercises.length}`
    : `Série ${currentRound}/${Math.max(1, block.rounds)}`

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        <Timer className="h-3.5 w-3.5" />
        Contexte en cours
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{contextText}</p>
    </div>
  )
}
