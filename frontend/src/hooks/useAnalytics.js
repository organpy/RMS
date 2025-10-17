import { get } from '../services/api'
import { useFetch } from './useFetch'

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
  const fetcher = async () => {
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
  }

  return useFetch(fetcher, [revenueMonths, revenueYears, memberGrowthMonths, paymentTrendMonths, classPopularityLimit])
}

export async function exportAnalyticsSummary() {
  return get('/api/analytics/export')
}
