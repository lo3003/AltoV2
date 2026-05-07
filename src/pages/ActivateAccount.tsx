import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Loader2, Lock, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ActivateAccount() {
  const navigate = useNavigate()
  const { activateClient } = useAuth()

  const [clientCode, setClientCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedCode = clientCode.trim().toUpperCase()

    if (!normalizedCode) {
      toast.error('Veuillez renseigner votre code client.')
      return
    }

    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.')
      return
    }

    setIsLoading(true)
    try {
      await activateClient(normalizedCode, password)
      toast.success('Compte activé avec succès.')
      navigate('/login', {
        replace: true,
        state: { activationMessage: 'Compte activé, connectez-vous' },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur pendant l\'activation du compte.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-slate-50/50 p-0 pt-safe pb-safe lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] overflow-hidden bg-white shadow-2xl shadow-slate-200/50 ring-1 ring-border/50 lg:rounded-[2rem]">
        <div className="relative hidden w-1/2 flex-col justify-end overflow-hidden bg-zinc-900 p-12 lg:flex">
          <img
            src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2670&auto=format&fit=crop"
            alt="Fitness training"
            className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="relative z-10 text-white">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-[2px] w-8 bg-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Activation Client</span>
            </div>
            <h2 className="text-4xl font-bold leading-tight">
              Activez votre espace<br />Alto Fitness.
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-zinc-300">
              Entrez le code fourni par votre coach puis définissez votre mot de passe pour démarrer.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
          <div className="mb-12 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Alto<span className="font-semibold text-primary">Fitness</span></span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Activer mon compte client</h1>
            <p className="mt-2 text-sm text-slate-500">
              Utilisez votre code client puis choisissez votre mot de passe.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="client-code" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Code client
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="client-code"
                  type="text"
                  placeholder="ID-ABCD1234"
                  value={clientCode}
                  onChange={(event) => setClientCode(event.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="h-12 rounded-xl border-none bg-slate-50 px-4 pl-10 font-semibold tracking-wide uppercase transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Au moins 6 caractères"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  className="h-12 rounded-xl border-none bg-slate-50 px-4 pl-10 pr-10 transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirmez le mot de passe"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isLoading}
                  className="h-12 rounded-xl border-none bg-slate-50 px-4 pl-10 pr-10 transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-xl bg-[#10b981] text-base font-semibold shadow-lg shadow-emerald-500/20 hover:bg-[#059669]" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Activer mon compte
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              Déjà activé ?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-bold text-[#10b981] hover:underline"
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}