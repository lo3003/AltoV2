import { Outlet } from 'react-router-dom'
import { CoachSidebar } from '@/components/coach/CoachSidebar'
import { CoachBottomNav } from '@/components/coach/CoachBottomNav'

export function CoachLayout() {
  return (
    <div className="min-h-[100dvh] bg-slate-50/50">
      {/* Desktop sidebar (hidden on mobile, app uses bottom nav instead) */}
      <CoachSidebar />

      {/* Main content area */}
      <div className="flex min-h-[100dvh] flex-col lg:pl-[260px]">
        {/*
          Mobile bottom-nav spacer:
          - mobile : reserve 64px + safe-area-inset-bottom for the fixed bottom nav
          - lg+    : sidebar layout, no bottom nav
        */}
        <main className="flex-1 with-bottom-nav-spacer lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — fixed, includes safe-area inset */}
      <CoachBottomNav />
    </div>
  )
}
