import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { getRememberMe, setRememberMe } from '@/lib/altoAuthStorage'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [roleMode, setRoleMode] = useState<'client' | 'coach'>('client')
  const [rememberMe, setRememberMeState] = useState<boolean>(() => getRememberMe())
  const activationMessage = (location.state as { activationMessage?: string } | null)?.activationMessage

  useEffect(() => {
    if (!user) return

    const path = user.role === 'coach' ? '/coach/dashboard' : '/client/dashboard'
    navigate(path, { replace: true })
  }, [user, navigate])

  if (user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      toast.error('Veuillez remplir tous les champs.')
      return
    }

    setIsLoading(true)
    try {
      // Apply the remember-me preference BEFORE login() so the session lands
      // in the correct storage from the start (localStorage vs sessionStorage).
      setRememberMe(rememberMe)
      await login(email, password)
      toast.success('Connexion réussie !')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion'
      if (message.includes('Invalid login credentials')) {
        toast.error('Email ou mot de passe incorrect.')
      } else {
        toast.error(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-slate-50/50 p-0 pt-safe pb-safe lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] overflow-hidden bg-white shadow-2xl shadow-slate-200/50 ring-1 ring-border/50 lg:rounded-[2rem]">
        
        {/* Left Side: Image / Brand Panel (hidden on small screens) */}
        <div className="relative hidden w-1/2 flex-col justify-end overflow-hidden bg-zinc-900 p-12 lg:flex">
          <img
            src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2670&auto=format&fit=crop"
            alt="Fitness training"
            className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          <div className="relative z-10 text-white">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-[2px] w-8 bg-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Excellence & Performance</span>
            </div>
            <h2 className="text-4xl font-bold leading-tight">
              Redéfinissez vos limites<br />avec Alto Fitness.
            </h2>
            <p className="mt-4 text-base text-zinc-300 max-w-sm leading-relaxed">
              Rejoignez la communauté de fitness la plus exclusive et suivez vos progrès en temps réel.
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex w-full flex-col justify-center px-5 py-8 sm:px-12 sm:py-12 lg:w-1/2 lg:px-20">
          
          {/* Logo */}
          <div className="mb-12 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Alto<span className="text-primary font-semibold">Fitness</span></span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Bon retour parmi nous
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Veuillez entrer vos identifiants pour accéder à votre espace.
            </p>
            {activationMessage && (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {activationMessage}
              </p>
            )}
          </div>

          <div className="mt-8">
            <Tabs value={roleMode} onValueChange={(v) => setRoleMode(v as 'client'|'coach')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="client" className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                  Espace Client
                </TabsTrigger>
                <TabsTrigger value="coach" className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                  Espace Coach
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {roleMode === 'client' && (
              <div className="mt-3 text-right">
                <button
                  type="button"
                  onClick={() => navigate('/activate')}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  J'ai un code client
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Adresse Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-12 rounded-xl border-none bg-slate-50 px-4 transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-12 rounded-xl border-none bg-slate-50 px-4 pr-10 transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMeState(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-slate-300 text-primary accent-[#10b981] focus:ring-2 focus:ring-primary/30"
                />
                <span className="font-medium text-slate-600">Rester connecté</span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {rememberMe ? 'Reste connecté sur cet appareil' : 'Ne reste connecté que cette session'}
                </span>
              </label>

              <Button type="submit" className="h-12 w-full rounded-xl bg-[#10b981] text-base font-semibold shadow-lg shadow-emerald-500/20 hover:bg-[#059669]" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="mt-auto pt-12 text-center">
            <p className="text-sm font-medium text-slate-500">
              Pas encore de compte ?{' '}
              <button
                type="button"
                onClick={() => navigate('/activate')}
                className="text-[#10b981] font-bold hover:underline"
              >
                S'inscrire gratuitement
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
