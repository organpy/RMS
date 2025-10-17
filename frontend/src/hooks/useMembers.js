import { useMemo } from 'react'
import { get, post, put } from '../services/api'
import { useFetch } from './useFetch'

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

  const fetcher = async () => {
    const response = await get(`${MEMBERS_ENDPOINT}${queryString ? `?${queryString}` : ''}`)
    return response
  }

  return useFetch(fetcher, [queryString])
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
