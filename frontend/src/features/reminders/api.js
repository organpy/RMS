import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

export const useReminders = (params) => useQuery({ queryKey: ['reminders', params], queryFn: () => api.get('/reminders', params) })

export const useLogReminders = () =>
  useMutate((body) => api.post('/reminders', body), {
    invalidate: ['reminders'],
    success: ({ logged }) => `Logged ${logged} reminder${logged === 1 ? '' : 's'}`,
  })
