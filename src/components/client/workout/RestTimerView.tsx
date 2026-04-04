import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

// Convert "01:30" or "90s" to seconds
const parseDuration = (durationString: string) => {
  if (!durationString) return 60 // default 60s
  if (durationString.includes(':')) {
    const [min, sec] = durationString.split(':')
    return parseInt(min, 10) * 60 + parseInt(sec, 10)
  }
  const minMatch = durationString.match(/(\d+)m/)
  const secMatch = durationString.match(/(\d+)s/)
  let total = 0
  if (minMatch) total += parseInt(minMatch[1], 10) * 60
  if (secMatch) total += parseInt(secMatch[1], 10)
  return total > 0 ? total : parseInt(durationString, 10) || 60
}

const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface RestTimerViewProps {
  duration: string
  nextExerciseName: string
  nextSetIndicator: string
  onComplete: () => void
  onSkip: () => void
}

export function RestTimerView({ duration, nextExerciseName, nextSetIndicator, onComplete, onSkip }: RestTimerViewProps) {
  const totalDuration = useMemo(() => parseDuration(duration), [duration])
  const [timeLeft, setTimeLeft] = useState(totalDuration)

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete()
      return
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, onComplete])

  const progress = (timeLeft / totalDuration) * 100
  // SVG circle calculations
  const radius = 120
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="absolute inset-0 z-40 bg-[#fbfbfb] flex flex-col items-center justify-between py-12 px-6 safe-area-pt">
      
      {/* Header Info */}
      <div className="text-center mt-8 space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-[#10b981]">Récupération</p>
        <h2 className="text-3xl font-black text-slate-900">{formatTime(timeLeft)}</h2>
      </div>

      {/* Big Circular Timer */}
      <div className="relative flex items-center justify-center flex-1 w-full max-w-[320px]">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 280 280">
          {/* Background Track */}
          <circle 
            cx="140" cy="140" r={radius} 
            className="stroke-slate-100" 
            strokeWidth="16" 
            fill="none" 
          />
          {/* Progress Track */}
          <circle 
            cx="140" cy="140" r={radius} 
            className="stroke-[#10b981] transition-all duration-1000 ease-linear" 
            strokeWidth="16" 
            fill="none" 
            strokeLinecap="round"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset
            }}
          />
        </svg>
        
        {/* Timer Text inside circle */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-black tracking-tighter text-slate-900">{formatTime(timeLeft)}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Temps restant</span>
        </div>
      </div>

      {/* Next Up Info & Actions */}
      <div className="w-full space-y-6">
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 w-full text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">À suivre</p>
          <h3 className="text-xl font-black text-slate-900">{nextExerciseName}</h3>
          <p className="text-sm font-semibold text-[#10b981] mt-1">{nextSetIndicator}</p>
        </div>

        <Button 
          onClick={onSkip}
          className="w-full h-16 rounded-[24px] bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 font-bold text-lg"
        >
          Passer le repos <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

    </div>
  )
}
