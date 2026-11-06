import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

/** Progress is derived from real data on the server, so refetch whenever a screen needs it. */
export const useOnboarding = () => useQuery({ queryKey: ['onboarding'], queryFn: () => api.get('/onboarding'), staleTime: 0 })

export const useDismissOnboarding = () => useMutate((dismissed) => api.put('/onboarding', { dismissed }), { invalidate: ['onboarding'] })

/** The checklist while it still matters: not hidden by an admin and a required step left. */
export function useSetupPending() {
  const { data } = useOnboarding()
  if (!data || data.dismissed || data.steps.every((s) => s.done || s.optional)) return null
  return data
}
