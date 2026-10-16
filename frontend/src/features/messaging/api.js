import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

export const CHANNEL_LABELS = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

export const useMessagingStatus = () =>
  useQuery({
    queryKey: ['messaging-status'],
    queryFn: () => api.get('/messaging/status'),
    staleTime: 5 * 60_000,
  })

export const useMessages = (params, options) =>
  useQuery({
    queryKey: ['messages', params],
    queryFn: () => api.get('/messages', params),
    ...options,
  })

const sentSummary = ({ sent, failed }) => (failed ? `Sent ${sent}, ${failed} failed. See the member's message history.` : `Sent ${sent} message${sent === 1 ? '' : 's'}`)

export const useSendMessages = () =>
  useMutate((body) => api.post('/messages', body), {
    invalidate: ['messages', 'reminders'],
    success: sentSummary,
  })

export const useRetryMessage = () =>
  useMutate((id) => api.post(`/messages/${id}/retry`), {
    invalidate: ['messages', 'reminders'],
    success: (m) => (m.status === 'sent' ? 'Message sent' : `Still failing: ${m.error}`),
  })

export const useTestMessage = () =>
  useMutate((body) => api.post('/messaging/test', body), {
    success: 'Test message sent',
  })
