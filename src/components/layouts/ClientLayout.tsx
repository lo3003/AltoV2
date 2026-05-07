import { Outlet } from 'react-router-dom'
import { ClientSidebar } from '@/components/client/ClientSidebar'
import { ClientBottomNav } from '@/components/client/ClientBottomNav'
import { ClientHeader } from '@/components/client/ClientHeader'

export function ClientLayout() {
  return (
    <div className="min-h-[100dvh] bg-slate-50/50">
      {/* Desktop sidebar (hidden on mobile, app uses bottom nav instead) */}
      <ClientSidebar />

      {/* Main column — flush on mobile, padded on desktop */}
      <div className="flex min-h-[100dvh] flex-col lg:pl-[220px]">
        <ClientHeader />

        {/*
          Bottom padding on mobile = bottom nav height (64px) + safe-area inset.
          On desktop the bottom nav is hidden so we revert to a normal padding.
        */}
        <main className="flex-1 px-4 py-4 with-bottom-nav-spacer lg:px-6 lg:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — fixed, includes safe-area inset */}
      <ClientBottomNav />
    </div>
  )
}
