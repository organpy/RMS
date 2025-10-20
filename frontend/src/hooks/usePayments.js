import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { del, get, getFile, post, put } from '../services/api'

const PAYMENTS_ENDPOINT = '/api/payments'
const RECEIPTS_ENDPOINT = '/api/receipts'

export function usePayments(filters = {}) {
  const queryString = useMemo(() => {
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value)
      }
    })
    return query.toString()
  }, [filters])

  const queryKey = ['payments', queryString]

  const query = useQuery({
    queryKey,
    queryFn: async () => get(`${PAYMENTS_ENDPOINT}${queryString ? `?${queryString}` : ''}`),
    keepPreviousData: true,
  })

  return {
    data: query.data,
    loading: query.isPending,
    error: query.error,
    refresh: query.refetch,
    isFetching: query.isFetching,
    queryKey,
  }
}

export function createPayment(payload) {
  return post(PAYMENTS_ENDPOINT, payload)
}

export function updatePayment(id, payload) {
  return put(`${PAYMENTS_ENDPOINT}/${id}`, payload)
}

export function queuePaymentReminder(paymentId, payload) {
  return post(`${PAYMENTS_ENDPOINT}/${paymentId}/reminders`, payload)
}

export function fetchPaymentReminder(paymentId) {
  return get(`${PAYMENTS_ENDPOINT}/${paymentId}/reminders`)
}

export function regenerateReceipt(paymentId) {
  return post(`${RECEIPTS_ENDPOINT}/${paymentId}/regenerate`)
}

export function deleteReceipt(receiptId) {
  return del(`${RECEIPTS_ENDPOINT}/${receiptId}`)
}

export function downloadReceipt(paymentId) {
  // Returns a Blob for the PDF
  return getFile(`/api/payments/${paymentId}/receipt`)
}
