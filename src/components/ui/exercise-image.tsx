import { useEffect, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExerciseImageProps {
  src?: string | null
  alt?: string
  className?: string
  fallbackClassName?: string
  iconClassName?: string
}

/**
 * Robust exercise image component with graceful fallback.
 * Handles:
 *  - null / undefined / empty `photo_url`
 *  - 404 / network errors (onError fallback)
 *  - URL changes (resets error state)
 */
export function ExerciseImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  iconClassName,
}: ExerciseImageProps) {
  const [hasError, setHasError] = useState(false)

  // Reset error state whenever src changes
  useEffect(() => {
    setHasError(false)
  }, [src])

  const trimmedSrc = typeof src === 'string' ? src.trim() : ''
  const showFallback = !trimmedSrc || hasError

  if (showFallback) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-100',
          fallbackClassName ?? className
        )}
      >
        <Dumbbell className={cn('h-6 w-6 text-slate-400', iconClassName)} />
      </div>
    )
  }

  return (
    <img
      src={trimmedSrc}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  )
}
