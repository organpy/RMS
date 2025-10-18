import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../services/api'

const DASHBOARD_WIDGETS_ENDPOINT = '/api/dashboard/widgets'
const DASHBOARD_ALERTS_ENDPOINT = '/api/dashboard/alerts'
const DASHBOARD_RECENT_ENDPOINT = '/api/dashboard/recent-activity'
const DASHBOARD_QUICK_ENDPOINT = '/api/dashboard/quick-stats'

export function useDashboard({
  referenceDate,
  alertsLimit = 5,
  recentLimit = 10,
  upcomingDays = 7,
  autoRefresh = false,
  refreshIntervalMs = 60 * 60 * 1000,
} = {}) {
  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (referenceDate) {
      query.set('reference_date', referenceDate)
    }
    return query.toString()
  }, [referenceDate])

  const alertsParams = useMemo(() => {
    const query = new URLSearchParams()
    if (referenceDate) {
      query.set('reference_date', referenceDate)
    }
    if (alertsLimit) {
      query.set('limit', alertsLimit)
    }
    return query.toString()
  }, [referenceDate, alertsLimit])

  const recentParams = useMemo(() => {
    const query = new URLSearchParams()
    if (recentLimit) {
      query.set('limit', recentLimit)
    }
    return query.toString()
  }, [recentLimit])

  const quickParams = useMemo(() => {
    const query = new URLSearchParams()
    if (referenceDate) {
      query.set('reference_date', referenceDate)
    }
    if (upcomingDays) {
      query.set('upcoming_days', upcomingDays)
    }
    if (alertsLimit) {
      query.set('limit', alertsLimit)
    }
    return query.toString()
  }, [referenceDate, upcomingDays, alertsLimit])

  const query = useQuery({
    queryKey: ['dashboard', params, alertsParams, recentParams, quickParams],
    queryFn: async () => {
      const [widgets, alerts, recentActivity, quickStats] = await Promise.all([
        get(`${DASHBOARD_WIDGETS_ENDPOINT}${params ? `?${params}` : ''}`),
        get(`${DASHBOARD_ALERTS_ENDPOINT}${alertsParams ? `?${alertsParams}` : ''}`),
        get(`${DASHBOARD_RECENT_ENDPOINT}${recentParams ? `?${recentParams}` : ''}`),
        get(`${DASHBOARD_QUICK_ENDPOINT}${quickParams ? `?${quickParams}` : ''}`),
      ])

      return {
        widgets,
        alerts,
        recentActivity,
        quickStats,
      }
    },
    keepPreviousData: true,
    refetchInterval: autoRefresh ? Math.max(refreshIntervalMs, 5 * 60 * 1000) : false,
  })

  return {
    data: query.data,
    loading: query.isPending,
    error: query.error,
    refresh: query.refetch,
    isFetching: query.isFetching,
  }
}
