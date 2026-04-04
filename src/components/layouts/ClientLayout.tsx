import { Outlet } from 'react-router-dom'
import { ClientSidebar } from '@/components/client/ClientSidebar'
import { ClientBottomNav } from '@/components/client/ClientBottomNav'
import { ClientHeader } from '@/components/client/ClientHeader'

export function ClientLayout() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Desktop Sidebar */}
      <ClientSidebar />

      {/* Main content area */}
      <div className="flex flex-col lg:pl-[220px]">
        <ClientHeader />

        <main className="flex-1 px-4 py-5 pb-24 lg:px-6 lg:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <ClientBottomNav />
    </div>
  )
}
