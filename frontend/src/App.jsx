import { lazy } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { BusinessProvider, useBusiness } from './context/BusinessContext'
import AppLayout from './components/layout/AppLayout'
import Spinner from './components/ui/Spinner'
import { Toaster } from './components/ui/toaster'
import { queryClient } from './lib/queryClient'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Members = lazy(() => import('./pages/Members'))
const Classes = lazy(() => import('./pages/Classes'))
const Payments = lazy(() => import('./pages/Payments'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BusinessProvider>
            <AppShell />
          </BusinessProvider>
        </AuthProvider>
      </ThemeProvider>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" buttonPosition="bottom-left" />
    </QueryClientProvider>
  )
}

function AppShell() {
  const {
    business,
    status: { loading, error },
    refresh,
  } = useBusiness()

  if (loading && !business) {
    return (
      <FullScreenState>
        <Spinner size="lg" className="text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your workspace…</p>
      </FullScreenState>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout globalError={error} onRetry={refresh} />}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="classes" element={<Classes />} />
          <Route path="payments" element={<Payments />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function FullScreenState({ children }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <div className="w-full max-w-md space-y-4">{children}</div>
    </main>
  )
}

export default App
