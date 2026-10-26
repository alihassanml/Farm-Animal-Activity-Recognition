import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { GuestOnly, RequireAuth } from './components/layout/Guards'
import { Loading } from './components/ui/States'
import { AuthProvider } from './context/AuthContext'
import AcceptInvite from './pages/AcceptInvite'
import Activity from './pages/Activity'
import Alerts from './pages/Alerts'
import Analyze from './pages/Analyze'
import Animals from './pages/Animals'
import { Login, Signup } from './pages/AuthPages'
import CameraLive from './pages/CameraLive'
import Cameras from './pages/Cameras'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import Onboarding, { AppHome } from './pages/Onboarding'
import Profile from './pages/Profile'
import WorkspaceSettings from './pages/WorkspaceSettings'

// Charts (recharts) are only needed on the dashboard, so load that page on demand.
const Dashboard = lazy(() => import('./pages/Dashboard'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />

          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppHome />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/w/:workspaceId" element={<AppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <Suspense fallback={<Loading />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route path="analyze" element={<Analyze />} />
              <Route path="cameras" element={<Cameras />} />
              <Route path="cameras/:cameraId" element={<CameraLive />} />
              <Route path="activity" element={<Activity />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="animals" element={<Animals />} />
              <Route path="settings" element={<WorkspaceSettings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
