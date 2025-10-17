import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { del, get, post, put } from '../services/api'

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

  const query = useQuery({
    queryKey: ['payments', queryString],
    queryFn: async () => get(`${PAYMENTS_ENDPOINT}${queryString ? `?${queryString}` : ''}`),
    keepPreviousData: true,
  })

  return {
    data: query.data,
    loading: query.isPending,
    error: query.error,
    refresh: query.refetch,
    isFetching: query.isFetching,
  }
}

export function createPayment(payload) {
  return post(PAYMENTS_ENDPOINT, payload)
}

export function updatePayment(id, payload) {
  return put(`${PAYMENTS_ENDPOINT}/${id}`, payload)
}

export function regenerateReceipt(paymentId) {
  return post(`${RECEIPTS_ENDPOINT}/${paymentId}/regenerate`)
}

export function deleteReceipt(receiptId) {
  return del(`${RECEIPTS_ENDPOINT}/${receiptId}`)
}
