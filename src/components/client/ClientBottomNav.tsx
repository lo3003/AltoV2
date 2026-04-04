import { NavLink, useLocation } from 'react-router-dom'
import { Home, BarChart3, CalendarDays, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/client/dashboard', label: 'Accueil', icon: Home },
  { to: '/client/planning', label: 'Planning', icon: CalendarDays },
  { to: '/client/messages', label: 'Messages', icon: MessageSquare },
  { to: '/client/stats', label: 'Stats', icon: BarChart3 },
]

export function ClientBottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full border-t border-border/40 bg-white/95 backdrop-blur-lg safe-bottom lg:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== '/client/dashboard' && location.pathname.startsWith(item.to))

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:scale-95'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200',
                  isActive && 'bg-primary/10'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-all duration-200',
                    isActive && 'stroke-[2.5]'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium transition-all duration-200',
                  isActive && 'font-semibold'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
