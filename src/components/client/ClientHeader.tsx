import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { useNavigate } from 'react-router-dom'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function ClientHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : 'C'

  const handleConfirmLogout = async () => {
    setLogoutOpen(false)
    await logout()
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/40 bg-white/95 backdrop-blur-lg pt-safe">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16 lg:px-6">
          {/* Logo (always visible — desktop sidebar already has another) */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/30">
              <span className="text-sm font-extrabold text-white">A</span>
            </div>
            <span className="text-sm font-bold text-foreground">Alto Fitness</span>
          </div>

          {/* Spacer on desktop (sidebar contains nav) */}
          <div className="hidden lg:block" />

          {/* Right section — touch targets ≥ 44×44 */}
          <div className="flex items-center gap-1">
            <NotificationBell />

            {/* Avatar — opens "Mon coach" page */}
            <button
              onClick={() => navigate('/client/coach')}
              className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-95"
              aria-label="Mon profil coach"
            >
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 transition-all hover:ring-primary/40">
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>

            {/* Logout — confirmation required */}
            <button
              onClick={() => setLogoutOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-95"
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
              Tu devras te reconnecter avec ton email et ton mot de passe pour revenir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
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
