import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export const useAuthStatus = () => useQuery({ queryKey: ['auth-status'], queryFn: () => api.get('/auth/status'), staleTime: Infinity })

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').catch((e) => (e.status === 401 ? null : Promise.reject(e))),
    staleTime: Infinity,
  })

function useSignIn(path) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post(path, body),
    onSuccess: (me) => {
      qc.setQueryData(['auth-status'], { setup_required: false })
      qc.setQueryData(['me'], me)
    },
  })
}

export const useLogin = () => useSignIn('/auth/login')
export const useSetup = () => useSignIn('/auth/setup')

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(['me'], null)
    },
  })
}
