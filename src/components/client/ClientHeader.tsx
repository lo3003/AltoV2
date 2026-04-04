import { Bell, Search, LogOut } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { useNavigate } from 'react-router-dom'

export function ClientHeader() {
  const { user, logout } = useAuth()
  const { unreadCount } = useUnreadMessages()
  const navigate = useNavigate()

  const initials = user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'C'

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-white/95 backdrop-blur-lg">
      <div className="flex h-14 items-center justify-between px-4 lg:h-16 lg:px-6">
        {/* Mobile logo (visible on small screens only) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="text-sm font-bold text-foreground">Alto Fitness</span>
        </div>

        {/* Search bar (desktop only) */}
        <div className="hidden lg:block lg:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un exercice..."
              className="h-9 bg-muted/50 pl-9 text-sm border-none"
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <button
            onClick={() => navigate('/client/messages')}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Avatar */}
          <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-primary/20 transition-all hover:ring-primary/40">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Logout Button */}
          <button
            onClick={() => logout()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Se déconnecter"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  )
}
