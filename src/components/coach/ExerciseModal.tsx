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
import { Clock, Trash2, Edit3, SlidersHorizontal, ImagePlus, Loader2 } from 'lucide-react'
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

export function ExerciseModal({ isOpen, onOpenChange, itemToEdit, onSave, onDelete }: ExerciseModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [formData, setFormData] = useState<Partial<Exercise>>({
    name: '',
    type: 'Renforcement',
    body_part: '',
    photo_url: '',
    charge_type: 'kg',
    sets: '',
    reps: '',
    duration_minutes: '',
    rest_time: '01:30'
  })

  // Sync itemToEdit to local state
  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        name: itemToEdit.name || '',
        type: itemToEdit.type || 'Renforcement',
        body_part: itemToEdit.body_part || '',
        photo_url: itemToEdit.photo_url || '',
        charge_type: itemToEdit.charge_type || 'kg',
        sets: itemToEdit.sets || '',
        reps: itemToEdit.reps || '',
        duration_minutes: itemToEdit.duration_minutes || '',
        rest_time: itemToEdit.rest_time || '01:30',
      })
    } else {
      setFormData({
        name: '',
        type: 'Renforcement',
        body_part: '',
        photo_url: '',
        charge_type: 'kg',
        sets: '',
        reps: '',
        duration_minutes: '',
        rest_time: '01:30'
      })
    }
  }, [itemToEdit, isOpen])

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Le nom de l'exercice est requis")
      return
    }
    await onSave(formData)
    onOpenChange(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error } = await supabase.storage
        .from('exercices')
        .upload(filePath, file)

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

  const isRenfo = formData.type === 'Renforcement'

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden bg-white">
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10b981]/10">
              <Edit3 className="h-5 w-5 text-[#10b981]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                {itemToEdit ? "Éditer l'exercice" : "Nouvel exercice"}
              </DialogTitle>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                BIBLIOTHÈQUE • GESTION DES MODÈLES
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold text-slate-600 hover:bg-slate-100">
              Annuler
            </Button>
            <Button onClick={handleSave} className="bg-[#10b981] font-bold text-white shadow-md hover:bg-[#059669] rounded-xl px-5">
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-8 bg-[#fbfbfb]">
          
          {/* Top Row: Name, Type & Media */}
          <div className="grid grid-cols-[1fr_1.2fr] gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Nom de l'exercice</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Barbell Squat" 
                  className="h-11 rounded-xl bg-white border-slate-200 shadow-sm font-medium" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Type d'exercice</Label>
                <Select 
                  value={formData.type || 'Renforcement'} 
                  onValueChange={(val) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 shadow-sm font-medium">
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Renforcement">Renforcement</SelectItem>
                    <SelectItem value="Cardio">Cardio</SelectItem>
                    <SelectItem value="Mobilité">Mobilité</SelectItem>
                    <SelectItem value="Étirement">Étirement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Ciblage musculaire</Label>
                <Select 
                  value={formData.body_part || ''} 
                  onValueChange={(val) => setFormData({ ...formData, body_part: val })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 shadow-sm font-medium">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Jambes">Jambes, Fessiers</SelectItem>
                    <SelectItem value="Pectoraux">Pectoraux</SelectItem>
                    <SelectItem value="Dos">Dos</SelectItem>
                    <SelectItem value="Epaules">Epaules</SelectItem>
                    <SelectItem value="Bras">Bras</SelectItem>
                    <SelectItem value="Abdo">Abdos</SelectItem>
                    <SelectItem value="Tout le corps">Tout le corps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 flex flex-col h-full">
              <Label className="text-xs font-bold text-slate-700">Image illustrative</Label>
              <div className="flex-1 min-h-[140px] rounded-xl border-2 border-dashed border-slate-200 bg-white overflow-hidden relative group hover:border-[#10b981]/50 transition-colors flex flex-col items-center justify-center cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 text-[#10b981] animate-spin mb-2" />
                    <span className="text-xs font-semibold text-slate-500">Envoi en cours...</span>
                  </div>
                ) : formData.photo_url ? (
                  <>
                    <img src={formData.photo_url} alt="Aperçu" className="w-full h-full object-cover absolute inset-0 group-hover:opacity-50 transition-opacity" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
                      <ImagePlus className="h-8 w-8 text-white mb-1" />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white">Changer l'image</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-slate-400 group-hover:text-[#10b981] transition-colors">
                    <ImagePlus className="h-10 w-10 mb-2 opacity-80" />
                    <span className="text-[11px] uppercase font-bold tracking-wider">Cliquez pour ajouter</span>
                    <span className="text-xs font-medium mt-1">Formats : JPG, PNG...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Execution Params */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#10b981]" />
                <h3 className="text-[15px] font-bold text-slate-900">Paramètres par défaut ({formData.type})</h3>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              
              {isRenfo ? (
                <>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-[#10b981]">SÉRIES</Label>
                    <Input 
                      value={formData.sets || ''}
                      onChange={(e) => setFormData({ ...formData, sets: e.target.value })}
                      placeholder="Ex: 4"
                      className="h-10 rounded-lg text-center font-semibold text-slate-800" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-[#10b981]">RÉPÉTITIONS</Label>
                    <Input 
                      value={formData.reps || ''}
                      onChange={(e) => setFormData({ ...formData, reps: e.target.value })}
                      placeholder="Ex: 10"
                      className="h-10 rounded-lg text-center font-semibold text-slate-800" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-[#10b981]">TYPE DE POIDS</Label>
                    <Select 
                      value={formData.charge_type || 'kg'}
                      onValueChange={(val) => setFormData({ ...formData, charge_type: val })}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-slate-200 font-medium text-sm">
                        <SelectValue placeholder="Unité" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilos (kg)</SelectItem>
                        <SelectItem value="PDC">Poids du corps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-[#10b981] flex items-center gap-1"><Clock className="h-3 w-3" /> REPOS</Label>
                    <Input 
                      value={formData.rest_time || ''}
                      onChange={(e) => setFormData({ ...formData, rest_time: e.target.value })}
                      placeholder="01:30" 
                      className="h-10 rounded-lg text-center font-mono font-bold tracking-widest text-slate-800 bg-slate-50" 
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-[#10b981] flex items-center gap-1">
                      <Clock className="h-3 w-3" /> TEMPS D'EXERCICE
                    </Label>
                    <Input 
                      value={formData.duration_minutes || ''}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      placeholder="Ex: 45s ou 01:00" 
                      className="h-10 rounded-lg font-semibold text-slate-800 bg-white" 
                    />
                  </div>
                  <div className="space-y-3 col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-[#10b981] flex items-center gap-1">
                      <Clock className="h-3 w-3" /> TEMPS DE REPOS
                    </Label>
                    <Input 
                      value={formData.rest_time || ''}
                      onChange={(e) => setFormData({ ...formData, rest_time: e.target.value })}
                      placeholder="Ex: 15s ou 00:30" 
                      className="h-10 rounded-lg font-mono font-bold tracking-widest text-slate-800 bg-slate-50" 
                    />
                  </div>
                </>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-100">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Clock className="h-3.5 w-3.5" /> Modifié récemment
            </span>
          </div>
          {itemToEdit && (
            <button 
              onClick={() => {
                onDelete(itemToEdit)
                onOpenChange(false)
              }}
              className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wider flex items-center gap-1.5"
            >
              SUPPRIMER <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
