import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { del, get, post, put } from '../services/api'

const MEMBERS_ENDPOINT = '/api/members'

export function useMembers({
  status,
  search,
  page = 1,
  pageSize = 10,
} = {}) {
  const queryConfig = useMemo(() => {
    const params = new URLSearchParams()
    const normalizedStatus = typeof status === 'string' && status.toUpperCase() !== 'ALL' ? status.toUpperCase() : undefined

    if (normalizedStatus) {
      params.set('status', normalizedStatus)
    }
    if (search) {
      params.set('search', search)
    }

    const safePage = Number.isFinite(page) && page > 0 ? page : 1
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
    const skip = (safePage - 1) * safePageSize

    params.set('skip', String(skip))
    params.set('limit', String(safePageSize))

    return {
      paramsString: params.toString(),
      skip,
      limit: safePageSize,
    }
  }, [page, pageSize, search, status])

  const queryKey = ['members', queryConfig.paramsString]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const raw = await get(`${MEMBERS_ENDPOINT}?${queryConfig.paramsString}`)
      const members = Array.isArray(raw?.members)
        ? raw.members
        : Array.isArray(raw?.data)
          ? raw.data
          : []
      const meta = raw?.meta ?? {
        total: members.length,
        skip: queryConfig.skip,
        limit: queryConfig.limit,
      }

      return { members, meta }
    },
    keepPreviousData: true,
  })

  return {
    members: query.data?.members ?? [],
    meta: query.data?.meta,
    loading: query.isPending,
    error: query.error,
    refresh: query.refetch,
    isFetching: query.isFetching,
    queryKey,
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

export function deleteMember(id) {
  return del(`${MEMBERS_ENDPOINT}/${id}`)
}
