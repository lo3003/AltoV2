import React, { useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useClientProfile } from '@/hooks/useClientProfile'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Camera, Trophy, Clock, Dumbbell, X, Loader2 } from 'lucide-react'
import { useWorkoutPreview } from '@/hooks/useWorkoutPreview'

/* -------------------------------------------------------------------------- */
/*  Ratings — order from the easiest (1) to the hardest (5), per spec PDF     */
/* -------------------------------------------------------------------------- */

const RATINGS: Array<{ value: number; emoji: string; label: string; tone: string }> = [
  { value: 1, emoji: '😎', label: 'Très facile', tone: 'bg-emerald-50 ring-emerald-200 text-emerald-700' },
  { value: 2, emoji: '😊', label: 'Facile', tone: 'bg-emerald-50 ring-emerald-200 text-emerald-700' },
  { value: 3, emoji: '🙂', label: 'Normal', tone: 'bg-slate-50 ring-slate-200 text-slate-700' },
  { value: 4, emoji: '😟', label: 'Difficile', tone: 'bg-amber-50 ring-amber-200 text-amber-700' },
  { value: 5, emoji: '😩', label: 'Très difficile', tone: 'bg-rose-50 ring-rose-200 text-rose-700' },
]

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  programId: string
  durationMinutes?: number
  isStoppedEarly?: boolean
}

export function FeedbackModal({
  isOpen,
  onClose,
  programId,
  durationMinutes = 0,
  isStoppedEarly = false,
}: FeedbackModalProps) {
  const { user } = useAuth()
  const { client } = useClientProfile()
  const { exercises } = useWorkoutPreview(programId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const exerciseCount = useMemo(
    () => exercises.filter((ex) => !ex.is_section_header).length,
    [exercises]
  )

  const firstName = useMemo(() => {
    const name = client?.full_name || user?.email?.split('@')[0] || ''
    return name.split(' ')[0] || ''
  }, [client?.full_name, user?.email])

  const selectedRating = RATINGS.find((r) => r.value === rating)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Le fichier doit être une image.')
      return
    }
    const MAX = 8 * 1024 * 1024
    if (file.size > MAX) {
      alert('Photo trop lourde (max 8 Mo).')
      return
    }

    setPhoto(file)
    // Create local preview
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearPhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photo || !user) return null

    const cleanName = photo.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .toLowerCase()

    const fileName = `${user.id}/${Date.now()}_${cleanName}`

    const { error } = await supabase.storage
      .from('confirmation-photo')
      .upload(fileName, photo, { contentType: photo.type })

    if (error) {
      console.error('Erreur upload:', error)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('confirmation-photo')
      .getPublicUrl(fileName)

    return publicUrl
  }

  const submitFeedback = async (forcedRating?: number) => {
    if (!user) return
    const finalRating = rating ?? forcedRating
    if (!finalRating && !isStoppedEarly) return

    setLoading(true)
    try {
      const photoUrl = await uploadPhoto()

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (clientError) throw clientError
      if (!clientData?.id) throw new Error('Client introuvable.')

      const payload = {
        client_id: clientData.id,
        program_id: programId,
        rating: finalRating ?? 3,
        feedback_notes: notes,
        confirmation_photo_url: photoUrl,
        duration_minutes: durationMinutes,
      }

      let { error } = await supabase.from('workout_logs').insert(payload)

      if (error?.code === 'PGRST204' && String(error.message || '').includes('duration_minutes')) {
        const { duration_minutes, ...fallback } = payload
        const r = await supabase.from('workout_logs').insert(fallback)
        error = r.error
      }

      if (error) throw error
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating && !isStoppedEarly) return
    await submitFeedback(isStoppedEarly ? 3 : undefined)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-[95vw] sm:max-w-md max-h-[95vh] rounded-[28px] p-0 bg-white border-none overflow-hidden flex flex-col"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-6 pt-7 pb-5 text-white">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30 backdrop-blur">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-2xl font-black tracking-tight text-white">
                {isStoppedEarly
                  ? 'Séance arrêtée'
                  : firstName
                    ? `Félicitations ${firstName} !`
                    : 'Félicitations !'}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/80">
                {isStoppedEarly
                  ? 'Ta progression est sauvegardée — tu peux quand même évaluer ton effort.'
                  : 'Tu as terminé ta séance. Prends un moment pour la noter.'}
              </DialogDescription>
            </DialogHeader>

            {/* Stats inline */}
            <div className="mt-4 flex items-center gap-2 text-xs font-bold">
              {exerciseCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
                  <Dumbbell className="h-3.5 w-3.5" />
                  {exerciseCount} exos
                </span>
              )}
              {durationMinutes > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
                  <Clock className="h-3.5 w-3.5" />
                  {durationMinutes} min
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Rating */}
          <div className="space-y-3">
            <p className="text-center text-sm font-bold text-slate-900">
              Comment as-tu ressenti la séance ?
            </p>

            <div className="flex items-stretch justify-between gap-1.5">
              {RATINGS.map((r) => {
                const isSelected = rating === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    aria-label={r.label}
                    className={`flex flex-1 items-center justify-center rounded-2xl py-3.5 transition-all ${
                      isSelected
                        ? 'bg-emerald-50 ring-2 ring-emerald-300 shadow-sm scale-[1.06]'
                        : 'bg-slate-50 ring-1 ring-slate-100 grayscale hover:grayscale-0 hover:ring-slate-200'
                    }`}
                  >
                    <span className="text-3xl leading-none">{r.emoji}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Très facile</span>
              <span>Très difficile</span>
            </div>

            {selectedRating && (
              <div
                className={`mx-auto flex w-fit items-center justify-center rounded-full px-3.5 py-1 text-xs font-bold ring-1 ${selectedRating.tone}`}
              >
                {selectedRating.label}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-900">
              Commentaire <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <Textarea
              placeholder="Ressenti, douleurs, humeur, fatigue…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              className="resize-none h-24 rounded-2xl bg-slate-50 border-transparent focus:border-emerald-300 focus:bg-white text-sm"
            />
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-900">
              Photo de fin <span className="font-normal text-slate-400">(optionnel)</span>
            </label>

            {photoPreview ? (
              <div className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200">
                <img src={photoPreview} alt="Aperçu" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                  aria-label="Retirer la photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-7 transition-colors hover:bg-slate-100">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <Camera className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-bold text-slate-500">Ajouter une photo</span>
              </label>
            )}
          </div>
        </form>

        {/* Footer (sticky) */}
        <div className="border-t border-slate-100 bg-white px-5 py-4 space-y-2">
          <Button
            type="button"
            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
            disabled={(!rating && !isStoppedEarly) || loading}
            className="h-13 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-base font-extrabold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              isStoppedEarly ? 'Enregistrer et terminer' : 'Valider ma séance'
            )}
          </Button>

          {isStoppedEarly && (
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              className="h-11 w-full rounded-2xl text-slate-500 hover:bg-slate-100"
              onClick={() => submitFeedback(3)}
            >
              Terminer sans appréciation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
