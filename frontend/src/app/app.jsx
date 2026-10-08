import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { RequireAuth } from '@/features/auth/require-auth'
import { queryClient } from '@/lib/query'

import { Layout } from './layout'

const LoginPage = lazy(() => import('@/features/auth/login-page'))
const SetupPage = lazy(() => import('@/features/auth/setup-page'))
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const MembersPage = lazy(() => import('@/features/members/members-page'))

function NotFound() {
  return <p className="text-muted-foreground">Page not found.</p>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{ className: 'text-sm' }} />
    </QueryClientProvider>
  )
}
