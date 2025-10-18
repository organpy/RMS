import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../services/api'

const PAYMENTS_ENDPOINT = '/api/payments'

export function useMemberPaymentHistory(memberId, { enabled = true, limit = 5 } = {}) {
  const query = useQuery({
    queryKey: ['member-payments', memberId, limit],
    enabled: enabled && Boolean(memberId),
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('member_id', String(memberId))
      if (limit != null) {
        params.set('limit', String(limit))
      }

      const response = await get(`${PAYMENTS_ENDPOINT}?${params.toString()}`)

      if (Array.isArray(response?.payments)) {
        return response.payments
      }
      if (Array.isArray(response?.data)) {
        return response.data
      }
      if (Array.isArray(response)) {
        return response
      }

      return []
    },
    staleTime: 1000 * 60 * 2,
  })

  const payments = useMemo(() => query.data ?? [], [query.data])

  return {
    payments,
    loading: query.isPending,
    error: query.error,
    refresh: query.refetch,
    isFetching: query.isFetching,
  }
}
