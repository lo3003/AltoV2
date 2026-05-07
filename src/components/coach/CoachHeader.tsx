import { useState } from 'react'
import { Plus, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface CoachHeaderProps {
  title?: string
  subtitle?: string
  onNewProgram?: () => void
}

export function CoachHeader({
  title = 'Bonjour Coach 👋',
  subtitle = "Voici l'activité du jour.",
  onNewProgram,
}: CoachHeaderProps) {
  const { logout } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleConfirmLogout = async () => {
    setLogoutOpen(false)
    await logout()
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-lg pt-safe lg:pt-8 lg:pb-4 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3 border-b border-slate-200/60 px-4 lg:h-auto lg:border-b-0 lg:px-0">

          {/* Left: Title (desktop) / Logo (mobile) */}
          <div className="min-w-0 flex-1">
            <div className="hidden lg:block">
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-white">A</span>
              </div>
              <span className="text-sm font-bold text-foreground">Alto Fitness</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {onNewProgram && (
              <Button
                onClick={onNewProgram}
                className="hidden gap-2 rounded-xl bg-primary px-4 font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary/90 sm:flex"
              >
                <Plus className="h-4 w-4" />
                Nouveau Client
              </Button>
            )}

            <NotificationBell />

            <button
              onClick={() => setLogoutOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-sm rounded-3xl border-none p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Se déconnecter ?</DialogTitle>
            <DialogDescription className="text-center">
              Tu devras te reconnecter avec ton email et ton mot de passe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setLogoutOpen(false)}
              className="h-11 rounded-xl font-bold"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmLogout}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold"
            >
              Déconnexion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
