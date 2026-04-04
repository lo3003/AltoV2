import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Camera, CheckCircle2 } from 'lucide-react'

// Dummy ratings
const RATINGS = [
  { value: 1, emoji: '😩', label: 'Très difficile' },
  { value: 2, emoji: '😟', label: 'Difficile' },
  { value: 3, emoji: '🙂', label: 'Modérée' },
  { value: 4, emoji: '😊', label: 'Facile' },
  { value: 5, emoji: '😎', label: 'Très facile' },
]

export function FeedbackModal({
  isOpen,
  onClose,
  programId,
  durationMinutes = 0,
  isStoppedEarly = false,
}: {
  isOpen: boolean
  onClose: () => void
  programId: string
  durationMinutes?: number
  isStoppedEarly?: boolean
}) {
  const { user } = useAuth()
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0])
    }
  }

  const uploadPhoto = async () => {
    if (!photo || !user) return null

    const cleanName = photo.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.]/g, "_")
      .toLowerCase()

    const fileName = `${user.id}/${Date.now()}_${cleanName}`
    
    const { error } = await supabase.storage
      .from('confirmation-photo')
      .upload(fileName, photo)

    if (error) {
      console.error("Erreur upload:", error)
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
    if (!finalRating) return

    setLoading(true)
    try {
      const photoUrl = await uploadPhoto()

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (clientError) throw clientError
      if (!clientData?.id) throw new Error('Client introuvable pour cet utilisateur.')

      const payload = {
        client_id: clientData.id,
        program_id: programId,
        rating: finalRating,
        feedback_notes: notes,
        confirmation_photo_url: photoUrl,
        duration_minutes: durationMinutes,
      }

      let { error } = await supabase.from('workout_logs').insert(payload)

      if (error?.code === 'PGRST204' && String(error.message || '').includes('duration_minutes')) {
        const { duration_minutes, ...fallbackPayload } = payload
        const fallbackResult = await supabase.from('workout_logs').insert(fallbackPayload)
        error = fallbackResult.error
      }

      if (error) throw error

      onClose()
    } catch (err) {
      console.error(err)
      // En production, afficher un toast ici
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating && !isStoppedEarly) return
    await submitFeedback(isStoppedEarly ? 3 : undefined)
  }

  const handleSkipWithSave = async () => {
    await submitFeedback(3)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md w-[95%] rounded-[32px] p-6 bg-white overflow-hidden outline-none"
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        
        <div className="flex justify-center mb-2">
          <div className="h-16 w-16 bg-[#10b981]/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[#10b981]" />
          </div>
        </div>

        <DialogHeader className="text-center sm:text-center space-y-2">
          <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
            {isStoppedEarly ? 'Séance arrêtée' : 'Félicitations ! 🎉'}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-500">
            {isStoppedEarly
              ? "Votre progression est sauvegardée. Vous pouvez laisser une appréciation si vous le souhaitez."
              : 'Vous avez terminé votre séance. Prenez un moment pour évaluer votre effort.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          
          <div className="space-y-4">
            <label className="block text-center text-sm font-bold text-slate-900">
              Comment était la séance ?
            </label>
            <div className="flex justify-between items-center gap-2">
              {RATINGS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRating(r.value)}
                  className={`flex flex-col items-center gap-2 p-2 rounded-2xl transition-all ${
                    rating === r.value 
                      ? 'bg-[#10b981]/10 transform scale-110' 
                      : 'hover:bg-slate-50 grayscale hover:grayscale-0 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="text-3xl">{r.emoji}</span>
                  {rating === r.value && (
                    <span className="text-[10px] font-bold text-[#10b981]">{r.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">Commentaire (Optionnel)</label>
            <Textarea 
              placeholder="Ressentis, douleurs, humeur..." 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-24 rounded-2xl bg-slate-50 border-transparent focus:border-[#10b981]/30 focus:bg-white text-sm"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">Photo de fin (Optionnel)</label>
            <div className="relative border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer overflow-hidden group">
              <input 
                type="file" 
                accept="image/*"
                onChange={handlePhotoChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center py-6 pointer-events-none">
                {photo ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-[#10b981] mb-2" />
                    <span className="text-sm font-bold text-slate-700 text-center max-w-[200px] truncate">{photo.name}</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-6 w-6 text-slate-400 mb-2 group-hover:text-[#10b981] transition-colors" />
                    <span className="text-sm font-bold text-slate-500">Appuyez pour ajouter</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={(!rating && !isStoppedEarly) || loading}
            className="w-full h-14 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-base font-bold shadow-lg shadow-[#10b981]/20 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? 'Envoi...' : isStoppedEarly ? 'Enregistrer et terminer' : 'Valider ma séance'}
          </Button>

          {isStoppedEarly && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              className="w-full h-12 rounded-2xl"
              onClick={handleSkipWithSave}
            >
              Terminer sans appréciation
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
