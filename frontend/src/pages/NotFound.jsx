import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center space-y-4 text-center">
      <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm font-medium uppercase tracking-wide text-primary">
        404
      </span>
      <h1 className="text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-md text-sm text-slate-500">
        The page you are trying to reach doesn&apos;t exist or has been moved. Check the URL or return to the dashboard.
      </p>
      <Button as={Link} to="/">
        Back to Dashboard
      </Button>
    </div>
  )
}
