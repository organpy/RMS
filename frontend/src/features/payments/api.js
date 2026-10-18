import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

const ROOTS = ['payments', 'members', 'dashboard', 'reminders', 'analytics']

export const usePayments = (params) => useQuery({ queryKey: ['payments', params], queryFn: () => api.get('/payments', params) })

export const useRecordPayment = () => useMutate((body) => api.post('/payments', body), { invalidate: ROOTS })

export const useRefund = () => useMutate((id) => api.post(`/payments/${id}/refund`), { invalidate: ROOTS, success: 'Payment refunded' })

export const useEmailInvoice = () => useMutate((id) => api.post(`/payments/${id}/email`), { invalidate: ['messages'], success: (m) => `Invoice emailed to ${m.recipient}` })

export const invoiceUrl = (id, download = false) => `/api/payments/${id}/invoice.pdf${download ? '?download=true' : ''}`
