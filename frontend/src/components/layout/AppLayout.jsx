import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Alert from '../ui/Alert'
import Button from '../ui/Button'

export default function AppLayout({ globalError, onRetry }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 py-8 lg:px-10">
          {globalError ? (
            <div className="mb-6">
              <Alert
                variant="warning"
                title="Working with offline settings"
                description={
                  globalError.detail ??
                  globalError.message ??
                  'We could not refresh the latest settings. Data shown may be outdated.'
                }
                actions={
                  onRetry ? (
                    <Button size="sm" onClick={onRetry}>
                      Retry
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
