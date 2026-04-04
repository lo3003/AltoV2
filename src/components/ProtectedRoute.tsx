import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/auth'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  allowedRole?: UserRole
}

export function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRole && user.role !== allowedRole) {
    // Redirect to the correct dashboard
    const redirectPath = user.role === 'coach' ? '/coach/dashboard' : '/client/dashboard'
    return <Navigate to={redirectPath} replace />
  }

  return <Outlet />
}
