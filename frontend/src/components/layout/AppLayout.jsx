import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'

export default function AppLayout({ globalError, onRetry }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            {globalError ? (
              <div className="mb-6">
              <Alert variant="warning" className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <AlertTitle>Working with offline settings</AlertTitle>
                    <AlertDescription>
                      {globalError.detail ??
                        globalError.message ??
                        'We could not refresh the latest settings. Data shown may be outdated.'}
                    </AlertDescription>
                  </div>
                  {onRetry ? (
                    <Button size="sm" onClick={onRetry}>
                      Retry
                    </Button>
                  ) : null}
                </div>
              </Alert>
              </div>
            ) : null}
            <Suspense fallback={<InlineRouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

function InlineRouteFallback() {
  return (
    <div className="flex items-center gap-3 py-10">
      <Spinner size="sm" className="text-primary" />
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  )
}
