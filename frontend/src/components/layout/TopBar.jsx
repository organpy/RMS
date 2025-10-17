import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../ui/Button'
import { NAVIGATION } from '../../utils/navigation'
import { useAuth } from '../../context/AuthContext'

export default function TopBar() {
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuth()

  const activePage = useMemo(() => {
    const match = NAVIGATION.find((item) => item.to === location.pathname)
    return match?.name ?? 'Overview'
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-400">Admin</span>
        <span className="text-sm font-medium text-slate-900">{activePage}</span>
      </div>
      <div className="flex items-center gap-3">
        <Button as={Link} to="/settings" variant="ghost" size="sm">
          Settings
        </Button>
        {isAuthenticated ? (
          <Button variant="secondary" size="sm" onClick={logout}>
            Sign out {user?.name ? `(${user.name})` : ''}
          </Button>
        ) : (
          <Button variant="secondary" size="sm">
            Sign in
          </Button>
        )}
      </div>
    </header>
  )
}
