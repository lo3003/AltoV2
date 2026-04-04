import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Settings,
  Dumbbell,
  MessageSquare,
  BookOpen,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const navItems = [
  { to: '/coach/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/coach/clients', label: 'Clients', icon: Users },
  { to: '/coach/programs', label: 'Gestion des Programmes', icon: Dumbbell },
  { to: '/coach/library', label: 'Bibliothèque', icon: BookOpen },
  { to: '/coach/messages', label: 'Messagerie', icon: MessageSquare },
  { to: '/coach/settings', label: 'Paramètres', icon: Settings },
]

export function CoachSidebar() {
  const { user } = useAuth()

  const coachName = user?.fullName || user?.email?.split('@')[0] || 'Alex Rivera'
  const initials = coachName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-r border-border/40 bg-[#fbfbfb] lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/20">
          <Dumbbell className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Alto Fitness</h1>
      </div>

      {/* Role Switcher Mockup */}
      <div className="px-6 pb-6">
        <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rôle Actuel</span>
            <span className="text-sm font-semibold text-slate-900">Espace Coach</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1.5 px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-[14px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
              )
            }
          >
            <item.icon className={cn("h-5 w-5", location.pathname === item.to ? "text-primary" : "text-slate-400")} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: User Profile */}
      <div className="border-t border-slate-200/60 p-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
            <AvatarImage src="https://i.pravatar.cc/150?u=coach" />
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{coachName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Pro Coach</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
