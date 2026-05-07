import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { CoachHeader } from '@/components/coach/CoachHeader'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExerciseImage } from '@/components/ui/exercise-image'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useExerciseLibrary } from '@/hooks/useExerciseLibrary'
import { useAuth } from '@/contexts/AuthContext'

const DEFAULT_FILTERS = {
  query: '',
  type: 'all',
  bodyPart: 'all',
}

const STORAGE_KEY_PREFIX = 'alto:coach:exercise-library:filters'

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`
}

/**
 * Read persisted filters synchronously, prioritizing URL params (for share links)
 * then falling back to localStorage. Runs at mount time to avoid the "empty filter flash".
 */
function readInitialFilters(userId: string | undefined, search: string) {
  // Server-side / SSR safety
  if (typeof window === 'undefined') return DEFAULT_FILTERS

  const params = new URLSearchParams(search)
  const urlQuery = params.get('q') || ''
  const urlType = params.get('type') || ''
  const urlBodyPart = params.get('body') || ''
  if (urlQuery || urlType || urlBodyPart) {
    return {
      query: urlQuery,
      type: urlType || DEFAULT_FILTERS.type,
      bodyPart: urlBodyPart || DEFAULT_FILTERS.bodyPart,
    }
  }

  if (!userId) return DEFAULT_FILTERS

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return DEFAULT_FILTERS
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_FILTERS>
    return {
      query: parsed.query ?? DEFAULT_FILTERS.query,
      type: parsed.type ?? DEFAULT_FILTERS.type,
      bodyPart: parsed.bodyPart ?? DEFAULT_FILTERS.bodyPart,
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

export default function CoachExerciseLibraryPage() {
  const { user } = useAuth()
  const { exercises, loading } = useExerciseLibrary()
  const [, setSearchParams] = useSearchParams()

  // Lazy initialization — synchronously reads URL+localStorage so filters
  // are restored on the very first render (no empty flash, no remounting reset).
  const initial = useState(() =>
    readInitialFilters(user?.id, typeof window !== 'undefined' ? window.location.search : '')
  )[0]
  const [query, setQuery] = useState(initial.query)
  const [typeFilter, setTypeFilter] = useState(initial.type)
  const [bodyPartFilter, setBodyPartFilter] = useState(initial.bodyPart)

  // If the user becomes available *after* mount (auth loading finishes),
  // re-hydrate once for that specific userId.
  const hydratedForUserRef = useRef<string | null>(user?.id ?? null)
  useEffect(() => {
    if (!user?.id) return
    if (hydratedForUserRef.current === user.id) return
    const restored = readInitialFilters(user.id, window.location.search)
    setQuery(restored.query)
    setTypeFilter(restored.type)
    setBodyPartFilter(restored.bodyPart)
    hydratedForUserRef.current = user.id
  }, [user?.id])

  // Persist on every change (URL + localStorage)
  useEffect(() => {
    if (!user?.id) return

    const trimmedQuery = query.trim()
    const next = new URLSearchParams()
    if (trimmedQuery) next.set('q', trimmedQuery)
    if (typeFilter !== DEFAULT_FILTERS.type) next.set('type', typeFilter)
    if (bodyPartFilter !== DEFAULT_FILTERS.bodyPart) next.set('body', bodyPartFilter)
    setSearchParams(next, { replace: true })

    try {
      window.localStorage.setItem(
        getStorageKey(user.id),
        JSON.stringify({
          query,
          type: typeFilter,
          bodyPart: bodyPartFilter,
        })
      )
    } catch {
      // localStorage unavailable (private mode, quota exceeded) — silently ignore
    }
  }, [user?.id, query, typeFilter, bodyPartFilter, setSearchParams])

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(exercises.map((item) => item.type?.trim()).filter((value): value is string => Boolean(value)))
    ).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [exercises])

  const bodyPartOptions = useMemo(() => {
    return Array.from(
      new Set(exercises.map((item) => item.body_part?.trim()).filter((value): value is string => Boolean(value)))
    ).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [exercises])

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return exercises.filter((exercise) => {
      const matchesQuery = !normalizedQuery
        || exercise.name.toLowerCase().includes(normalizedQuery)
        || String(exercise.body_part || '').toLowerCase().includes(normalizedQuery)
        || String(exercise.type || '').toLowerCase().includes(normalizedQuery)

      const matchesType =
        typeFilter === DEFAULT_FILTERS.type
        || String(exercise.type || '').toLowerCase() === typeFilter.toLowerCase()

      const matchesBodyPart =
        bodyPartFilter === DEFAULT_FILTERS.bodyPart
        || String(exercise.body_part || '').toLowerCase() === bodyPartFilter.toLowerCase()

      return matchesQuery && matchesType && matchesBodyPart
    })
  }, [exercises, query, typeFilter, bodyPartFilter])

  const hasActiveFilters =
    query.trim().length > 0
    || typeFilter !== DEFAULT_FILTERS.type
    || bodyPartFilter !== DEFAULT_FILTERS.bodyPart

  return (
    <div className="flex flex-col bg-slate-50">
      <CoachHeader
        title="Bibliothèque d'exercices"
        subtitle="Recherchez rapidement des exercices par type ou zone ciblée."
      />

      <div className="px-4 py-5 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-7xl space-y-5 lg:space-y-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher (ex: Renforcement, Dos)"
                  className="h-10 rounded-xl bg-white pl-10"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl bg-white lg:w-[220px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {typeOptions.map((typeOption) => (
                    <SelectItem key={typeOption} value={typeOption}>
                      {typeOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={bodyPartFilter} onValueChange={setBodyPartFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl bg-white lg:w-[220px]">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les zones</SelectItem>
                  {bodyPartOptions.map((bodyPartOption) => (
                    <SelectItem key={bodyPartOption} value={bodyPartOption}>
                      {bodyPartOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => {
                  setQuery(DEFAULT_FILTERS.query)
                  setTypeFilter(DEFAULT_FILTERS.type)
                  setBodyPartFilter(DEFAULT_FILTERS.bodyPart)
                }}
                disabled={!hasActiveFilters}
              >
                Réinitialiser
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>{filteredExercises.length} exercice(s) trouvé(s)</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Filtres actifs
                </Badge>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed bg-white py-12 text-center text-slate-500">
              Chargement de la bibliothèque...
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white py-12 text-center text-slate-500">
              Aucun exercice ne correspond à ces paramètres.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredExercises.map((exercise) => (
                <Card key={exercise.id} className="border-none bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200/60 bg-slate-100">
                      <ExerciseImage
                        src={exercise.photo_url}
                        alt={exercise.name}
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{exercise.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{exercise.body_part || 'Zone non définie'}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {exercise.type && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                        {exercise.type}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}