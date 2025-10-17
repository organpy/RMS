import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get, post, put } from '../services/api'

const MEMBERS_ENDPOINT = '/api/members'

export function useMembers(filters = {}) {
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
    queryKey: ['members', queryString],
    queryFn: async () => get(`${MEMBERS_ENDPOINT}${queryString ? `?${queryString}` : ''}`),
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

export function createMember(payload) {
  return post(MEMBERS_ENDPOINT, payload)
}

export function updateMember(id, payload) {
  return put(`${MEMBERS_ENDPOINT}/${id}`, payload)
}

export function updateMemberStatus(id, payload) {
  return put(`${MEMBERS_ENDPOINT}/${id}/status`, payload)
}
