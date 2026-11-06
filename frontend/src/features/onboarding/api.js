import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

/** Progress is derived from real data on the server, so refetch whenever a screen needs it. */
export const useOnboarding = () => useQuery({ queryKey: ['onboarding'], queryFn: () => api.get('/onboarding'), staleTime: 0 })

export const useDismissOnboarding = () => useMutate((dismissed) => api.put('/onboarding', { dismissed }), { invalidate: ['onboarding'] })
