import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ClientLayout } from '@/components/layouts/ClientLayout'
import { CoachLayout } from '@/components/layouts/CoachLayout'
import { Toaster } from '@/components/ui/sonner'
import Login from '@/pages/Login'
import CoachDashboard from '@/pages/coach/Dashboard'
import ClientsPage from '@/pages/coach/Clients'
import ClientDetail from '@/pages/coach/ClientDetail'
import ProgramsPage from '@/pages/coach/Programs'
import CoachExerciseLibraryPage from '@/pages/coach/Library'
import ProgramBuilder from '@/pages/coach/ProgramBuilder'
import CoachMessagesPage from '@/pages/coach/Messages'
import ClientDashboard from '@/pages/client/Dashboard'
import ClientPlanningPage from '@/pages/client/Planning'
import ClientMessagesPage from '@/pages/client/Messages'
import ClientStatsPage from '@/pages/client/Stats'
import ActiveWorkout from '@/pages/client/workout/ActiveWorkout'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Coach routes with Layout */}
          <Route element={<ProtectedRoute allowedRole="coach" />}>
            <Route element={<CoachLayout />}>
              <Route path="/coach/dashboard" element={<CoachDashboard />} />
              <Route path="/coach/clients" element={<ClientsPage />} />
              <Route path="/coach/clients/:id" element={<ClientDetail />} />
              <Route path="/coach/programs" element={<ProgramsPage />} />
              <Route path="/coach/library" element={<CoachExerciseLibraryPage />} />
              <Route path="/coach/messages" element={<CoachMessagesPage />} />
              <Route path="/coach/programs/builder" element={<ProgramBuilder />} />
              <Route path="/coach/programs/builder/:id" element={<ProgramBuilder />} />
            </Route>
          </Route>

          {/* Protected Client routes with Layout */}
          <Route element={<ProtectedRoute allowedRole="client" />}>
            <Route element={<ClientLayout />}>
              <Route path="/client/dashboard" element={<ClientDashboard />} />
              <Route path="/client/planning" element={<ClientPlanningPage />} />
              <Route path="/client/messages" element={<ClientMessagesPage />} />
              <Route path="/client/stats" element={<ClientStatsPage />} />
            </Route>
            
            {/* Fullscreen Client Routes WITHOUT Layout */}
            <Route path="/client/workout/:programId" element={<ActiveWorkout />} />

          </Route>

          {/* Catch-all: redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  )
}
