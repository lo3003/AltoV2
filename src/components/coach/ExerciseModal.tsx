import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Edit3, ImagePlus, Loader2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Exercise } from '@/hooks/useExerciseLibrary'
import { toast } from 'sonner'

interface ExerciseModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  itemToEdit: Exercise | null
  onSave: (data: Partial<Exercise>) => Promise<void>
  onDelete: (item: Exercise) => Promise<void>
}

const EXERCISE_TYPES = [
  { value: 'Renforcement', label: 'Renforcement' },
  { value: 'Cardio', label: 'Cardio' },
  { value: 'Mobilité', label: 'Mobilité articulaire' },
  { value: 'Étirement', label: 'Étirement' },
]

const BODY_PARTS = [
  'Jambes',
  'Fessiers',
  'Pectoraux',
  'Dos',
  'Épaules',
  'Bras',
  'Abdos',
  'Tout le corps',
  'Mobilité générale',
]

export function ExerciseModal({ isOpen, onOpenChange, itemToEdit, onSave, onDelete }: ExerciseModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [formData, setFormData] = useState<Partial<Exercise>>({
    name: '',
    type: 'Renforcement',
    body_part: '',
    photo_url: '',
  })

  // Sync itemToEdit to local state
  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        name: itemToEdit.name || '',
        type: itemToEdit.type || 'Renforcement',
        body_part: itemToEdit.body_part || '',
        photo_url: itemToEdit.photo_url || '',
      })
    } else {
      setFormData({
        name: '',
        type: 'Renforcement',
        body_part: '',
        photo_url: '',
      })
    }
    setConfirmDelete(false)
  }, [itemToEdit, isOpen])

  const handleSave = async () => {
    if (!formData.name || !formData.name.trim()) {
      toast.error("Le nom de l'exercice est requis")
      return
    }
    setIsSaving(true)
    try {
      await onSave(formData)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePress = () => {
    if (!itemToEdit) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      window.setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    onDelete(itemToEdit)
    onOpenChange(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error("Le fichier doit être une image (JPG, PNG, WEBP, GIF).")
      return
    }
    const MAX_SIZE_MB = 8
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`L'image dépasse ${MAX_SIZE_MB} Mo. Compresse-la avant upload.`)
      return
    }

    try {
      setIsUploading(true)
      const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error } = await supabase.storage
        .from('exercices')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('exercices')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, photo_url: publicUrl }))
      toast.success('Image ajoutée avec succès !')
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast.error(`Erreur lors de l'envoi de l'image: ${error.message}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="
          flex flex-col gap-0 border-none bg-white p-0 shadow-2xl
          /* MOBILE: full-screen edge-to-edge */
          fixed inset-0 left-0 top-0 max-w-none translate-x-0 translate-y-0 rounded-none h-[100dvh] w-full
          /* DESKTOP: centered card */
          sm:fixed sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[640px] sm:h-auto sm:max-h-[90vh] sm:rounded-3xl
        "
      >
        {/* Header — sticky on mobile */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white pt-safe sm:pt-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#10b981]/10 sm:h-10 sm:w-10">
              <Edit3 className="h-4 w-4 text-[#10b981] sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold tracking-tight text-slate-900 sm:text-xl">
                {itemToEdit ? "Éditer l'exercice" : "Nouvel exercice"}
              </DialogTitle>
              <p className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block sm:mt-0.5">
                BIBLIOTHÈQUE • FICHE EXERCICE
              </p>
            </div>
          </div>

          {/* Mobile: just an X close. Desktop: full Cancel + Save buttons */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 sm:hidden"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="hidden gap-2 sm:flex">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#10b981] font-bold text-white shadow-md hover:bg-[#059669] rounded-xl px-5"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sauvegarder'}
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfbfb] px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-5 sm:space-y-6">
            <p className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-slate-600">
              Les paramètres d'exécution (séries, répétitions, charge, repos) se configurent
              <strong> au moment de la création du programme</strong>, pas ici.
            </p>

            {/* Image upload — first on mobile for visual impact */}
            <div className="space-y-2 sm:hidden">
              <Label className="text-xs font-bold text-slate-700">Image illustrative</Label>
              <ImageUploadField
                photoUrl={formData.photo_url}
                isUploading={isUploading}
                onClick={() => fileInputRef.current?.click()}
                fileInputRef={fileInputRef}
                onChange={handleImageUpload}
                onClear={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                compact
              />
            </div>

            {/* Top Row: Name + Type/Zone (left) + Image (right desktop) */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.2fr] md:gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nom de l'exercice</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Pont fessier"
                    className="h-11 rounded-xl bg-white border-slate-200 shadow-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Type d'exercice</Label>
                  <Select
                    value={formData.type || 'Renforcement'}
                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 shadow-sm font-medium">
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {EXERCISE_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Zone ciblée</Label>
                  <Select
                    value={formData.body_part || ''}
                    onValueChange={(val) => setFormData({ ...formData, body_part: val })}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 shadow-sm font-medium">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {BODY_PARTS.map((zone) => (
                        <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Desktop image upload (full height) */}
              <div className="hidden flex-col space-y-2 sm:flex">
                <Label className="text-xs font-bold text-slate-700">Image illustrative</Label>
                <ImageUploadField
                  photoUrl={formData.photo_url}
                  isUploading={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  fileInputRef={fileInputRef}
                  onChange={handleImageUpload}
                  onClear={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                />
              </div>
            </div>

            {/* Mobile: delete inline (in body, not footer) */}
            {itemToEdit && (
              <div className="border-t border-slate-200/70 pt-4 sm:hidden">
                <button
                  type="button"
                  onClick={handleDeletePress}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                    confirmDelete
                      ? 'bg-red-600 text-white shadow-md shadow-red-500/30'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  {confirmDelete ? "Confirmer la suppression" : "Supprimer cet exercice"}
                </button>
                {confirmDelete && (
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Tape à nouveau pour confirmer • s'annule dans 3s
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer — sticky on mobile (Save button), inline on desktop (delete only) */}
        <div className="shrink-0 border-t border-slate-100 bg-white">
          {/* MOBILE: Big save button */}
          <div className="flex items-center gap-2 px-4 py-3 pb-safe sm:hidden">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-12 flex-1 rounded-xl border-slate-200 font-bold text-slate-700"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-12 flex-[2] gap-2 rounded-xl bg-[#10b981] font-bold text-white shadow-md hover:bg-[#059669]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Sauvegarder
                </>
              )}
            </Button>
          </div>

          {/* DESKTOP: Delete on right (only when editing) */}
          <div className="hidden items-center justify-end px-6 py-4 sm:flex">
            {itemToEdit && (
              <button
                onClick={handleDeletePress}
                className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  confirmDelete ? 'text-white bg-red-600 px-3 py-1.5 rounded-md' : 'text-red-500 hover:text-red-600'
                }`}
              >
                {confirmDelete ? 'CONFIRMER' : 'SUPPRIMER'} <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Image Upload Field                                                         */
/* -------------------------------------------------------------------------- */

function ImageUploadField({
  photoUrl,
  isUploading,
  onClick,
  fileInputRef,
  onChange,
  onClear,
  compact = false,
}: {
  photoUrl: string | null | undefined
  isUploading: boolean
  onClick: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  compact?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-white transition-colors hover:border-[#10b981]/50 ${
        compact ? 'h-44' : 'flex-1 min-h-[200px]'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onChange}
      />

      {isUploading ? (
        <div className="flex flex-col items-center justify-center p-4">
          <Loader2 className="h-8 w-8 text-[#10b981] animate-spin mb-2" />
          <span className="text-xs font-semibold text-slate-500">Envoi en cours…</span>
        </div>
      ) : photoUrl ? (
        <>
          <img src={photoUrl} alt="Aperçu" className="absolute inset-0 h-full w-full object-cover transition-opacity group-hover:opacity-50" />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100">
            <ImagePlus className="mb-1 h-7 w-7 text-white" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white">Changer l'image</span>
          </div>
          {/* Quick clear button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur hover:bg-black/80"
            aria-label="Retirer l'image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-slate-400 transition-colors group-hover:text-[#10b981]">
          <ImagePlus className="mb-2 h-9 w-9 opacity-80" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Cliquez pour ajouter</span>
          <span className="mt-1 text-xs font-medium">JPG, PNG, WEBP — max 8 Mo</span>
        </div>
      )}
    </div>
  )
}
