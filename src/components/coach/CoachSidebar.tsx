import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  MessageSquare,
  BookOpen,
  ShieldCheck,
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

      {/* Role indicator (informative, not a switcher) */}
      <div className="px-6 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
            Espace Coach
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-white font-bold shadow-sm shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700')} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: User Profile */}
      <div className="border-t border-slate-200/60 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{coachName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Pro Coach</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
