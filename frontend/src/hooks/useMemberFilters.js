import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../services/api'

const CLASSES_ENDPOINT = '/api/classes'

export function useMemberFilters({ enabled = true, limit = 200 } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))

  const queryKey = ['member-filter-options', { limit }]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await get(`${CLASSES_ENDPOINT}?${params.toString()}`)
      return Array.isArray(response?.data) ? response.data : []
    },
    enabled,
    staleTime: 1000 * 60 * 10,
  })

  const classes = query.data ?? []

  const classOptions = useMemo(() => {
    const classes = query.data ?? []
    return classes.map((classCourse) => ({
      value: String(classCourse.id),
      label: classCourse.name ?? `Class ${classCourse.id}`,
    }))
  }, [query.data])

  const groupOptions = useMemo(() => {
    const classesList = query.data ?? []
    return classesList.flatMap((classCourse) =>
      (classCourse.groups ?? []).map((group) => ({
        value: String(group.id),
        label: group.name ?? `Group ${group.id}`,
        classId: classCourse.id,
        className: classCourse.name ?? `Class ${classCourse.id}`,
      })),
    )
  }, [query.data])

  return {
    classes,
    classOptions,
    groupOptions,
    loading: query.isPending,
    error: query.error,
    refresh: query.refetch,
    isFetching: query.isFetching,
  }
}
