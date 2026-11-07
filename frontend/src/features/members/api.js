import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

const ROOTS = ['members', 'dashboard', 'courses', 'reminders', 'plans', 'roster', 'onboarding']

export const useMembers = (params, { enabled = true } = {}) => useQuery({ queryKey: ['members', params], queryFn: () => api.get('/members', params), enabled })

export const useMember = (id) => useQuery({ queryKey: ['members', 'one', id], queryFn: () => api.get(`/members/${id}`), enabled: !!id, placeholderData: undefined })

export const useSaveMember = () =>
  useMutate(({ id, ...body }) => (id ? api.patch(`/members/${id}`, body) : api.post('/members', body)), {
    invalidate: ROOTS,
    success: (m, v) => (v.id ? 'Member updated' : `${m.full_name} added`),
  })

export const useDeleteMember = () => useMutate((id) => api.del(`/members/${id}`), { invalidate: [...ROOTS, 'payments'], success: 'Member deleted' })
