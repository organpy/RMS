import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

export const useSession = (groupId, day) =>
  useQuery({ queryKey: ['attendance', groupId, day], queryFn: () => api.get(`/groups/${groupId}/sessions/${day}`), enabled: !!(groupId && day), placeholderData: undefined })

export const useSaveSession = (groupId) =>
  useMutate(({ day, records }) => api.put(`/groups/${groupId}/sessions/${day}`, { records }), { invalidate: ['attendance', 'roster', 'analytics'], success: 'Attendance saved' })
