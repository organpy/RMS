import { useQuery } from '@tanstack/react-query'
import { get } from '../services/api'

const ANALYTICS_BASE = '/api/analytics'

const route = (path, params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, value)
    }
  })
  const queryString = query.toString()
  return `${ANALYTICS_BASE}${path}${queryString ? `?${queryString}` : ''}`
}

export function useAnalytics({
  revenueMonths = 12,
  revenueYears = 5,
  memberGrowthMonths = 12,
  paymentTrendMonths = 6,
  classPopularityLimit = 5,
} = {}) {
  const query = useQuery({
    queryKey: ['analytics', revenueMonths, revenueYears, memberGrowthMonths, paymentTrendMonths, classPopularityLimit],
    queryFn: async () => {
      const [monthlyRevenue, yearlyRevenue, memberGrowth, paymentTrends, classPopularity] = await Promise.all([
        get(route('/revenue-monthly', { last_periods: revenueMonths })),
        get(route('/revenue-yearly', { last_years: revenueYears })),
        get(route('/members-growth', { last_periods: memberGrowthMonths })),
        get(route('/payment-trends', { last_months: paymentTrendMonths })),
        get(route('/class-popularity', { limit: classPopularityLimit })),
      ])

      return {
        monthlyRevenue,
        yearlyRevenue,
        memberGrowth,
        paymentTrends,
        classPopularity,
      }
    },
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

export async function exportAnalyticsSummary() {
  return get('/api/analytics/export')
}
