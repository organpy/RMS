import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../services/api'

const CLASSES_ENDPOINT = '/api/classes'

export function useClasses({ businessId, page = 1, pageSize = 50, enabled = true } = {}) {
  const queryConfig = useMemo(() => {
    const params = new URLSearchParams()

    if (businessId) {
      params.set('business_id', String(businessId))
    }

    const safePage = Number.isFinite(page) && page > 0 ? page : 1
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50
    const skip = (safePage - 1) * safePageSize

    params.set('skip', String(skip))
    params.set('limit', String(safePageSize))

    return {
      paramsString: params.toString(),
      skip,
      limit: safePageSize,
    }
  }, [businessId, page, pageSize])

  const queryKey = useMemo(() => ['classes', queryConfig.paramsString], [queryConfig.paramsString])

  const query = useQuery({
    queryKey,
    enabled,
    keepPreviousData: true,
    queryFn: async () => {
      const url = queryConfig.paramsString ? `${CLASSES_ENDPOINT}?${queryConfig.paramsString}` : CLASSES_ENDPOINT
      const raw = await get(url)
      const classes = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.classes) ? raw.classes : []
      const meta = raw?.meta ?? {
        total: classes.length,
        skip: queryConfig.skip,
        limit: queryConfig.limit,
      }
      return { classes, meta }
    },
  })

  return {
    classes: query.data?.classes ?? [],
    meta: query.data?.meta,
    loading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refresh: query.refetch,
    queryKey,
  }
}

export default useClasses
