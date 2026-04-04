import { Bell, Plus, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { useNavigate } from 'react-router-dom'

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
  const { unreadCount } = useUnreadMessages()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 bg-slate-50/50 backdrop-blur-lg lg:pt-8 lg:pb-4 lg:px-8">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-auto lg:px-0">
        
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
        <div className="flex items-center gap-3">
          {onNewProgram && (
            <Button
              onClick={onNewProgram}
              className="hidden gap-2 rounded-xl bg-[#10b981] px-4 font-semibold text-white shadow-sm hover:bg-[#059669] sm:flex"
            >
              <Plus className="h-4 w-4" />
              Nouveau Client
            </Button>
          )}

          <button
            onClick={() => navigate('/coach/messages')}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={() => logout()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Se déconnecter"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  )
}
