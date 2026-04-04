import { NavLink } from 'react-router-dom'
import { Home, BarChart3, CalendarDays, MessageSquare, Dumbbell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/client/dashboard', label: 'Accueil', icon: Home },
  { to: '/client/planning', label: 'Planning', icon: CalendarDays },
  { to: '/client/messages', label: 'Messages', icon: MessageSquare },
  { to: '/client/stats', label: 'Statistiques', icon: BarChart3 },
]

export function ClientSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[220px] flex-col border-r border-border/40 bg-white lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
          <Dumbbell className="h-[18px] w-[18px] text-white" />
        </div>
        <div>
          <h1 className="text-[15px] font-bold leading-tight text-foreground">Alto Fitness</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Espace Client
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-white shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/40 p-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Settings className="h-[18px] w-[18px]" />
          <span>Réglages</span>
        </button>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-primary/5 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            C
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Client</span>
        </div>
      </div>
    </aside>
  )
}
