import { Outlet } from 'react-router-dom'
import { CoachSidebar } from '@/components/coach/CoachSidebar'
import { CoachBottomNav } from '@/components/coach/CoachBottomNav'

export function CoachLayout() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Desktop Sidebar */}
      <CoachSidebar />

      {/* Main content area */}
      <div className="flex flex-col lg:pl-[260px]">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <CoachBottomNav />
    </div>
  )
}
