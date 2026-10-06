import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStatus, useMe } from './api'

export function RequireAuth({ children }) {
  const qc = useQueryClient()
  const location = useLocation()
  const status = useAuthStatus()
  const me = useMe()

  useEffect(() => {
    const signOut = () => qc.setQueryData(['me'], null)
    window.addEventListener('rms:unauthorized', signOut)
    return () => window.removeEventListener('rms:unauthorized', signOut)
  }, [qc])

  if (status.isPending || me.isPending) return null
  if (status.data?.setup_required) return <Navigate to="/setup" replace />
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}
