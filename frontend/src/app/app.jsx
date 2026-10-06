import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { RequireAuth } from '@/features/auth/require-auth'
import { queryClient } from '@/lib/query'

const LoginPage = lazy(() => import('@/features/auth/login-page'))
const SetupPage = lazy(() => import('@/features/auth/setup-page'))

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <p className="p-8">Signed in.</p>
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{ className: 'text-sm' }} />
    </QueryClientProvider>
  )
}
