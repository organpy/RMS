import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

export const usePlans = (params = {}) => useQuery({ queryKey: ['plans', params], queryFn: () => api.get('/plans', params) })

export const useSavePlan = () =>
  useMutate(({ id, ...body }) => (id ? api.patch(`/plans/${id}`, body) : api.post('/plans', body)), {
    invalidate: ['plans', 'members'],
    success: (_, v) => (v.id ? 'Plan updated' : 'Plan created'),
  })
