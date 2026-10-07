import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export const useOrg = () => useQuery({ queryKey: ['organization'], queryFn: () => api.get('/organization'), staleTime: Infinity })

export function useUpdateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.patch('/organization', body),
    onSuccess: (org) => qc.setQueryData(['organization'], org),
  })
}

export function useLogo() {
  const qc = useQueryClient()
  const onSuccess = (org) => {
    qc.setQueryData(['organization'], org)
    qc.setQueryData(['logo-version'], Date.now())
  }
  return {
    upload: useMutation({
      mutationFn: (file) => {
        const body = new FormData()
        body.append('file', file)
        return api.put('/organization/logo', body)
      },
      onSuccess,
    }),
    remove: useMutation({ mutationFn: () => api.del('/organization/logo'), onSuccess }),
  }
}
