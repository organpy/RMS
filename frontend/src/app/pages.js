import { lazy } from 'react'

/** Route pages, split into their own files. ``preloadPages`` fetches them all in the background after
 * sign-in so the first tap on a page does not wait for its code (slow on a phone over Wi-Fi). */
const loaders = []
const page = (load) => {
  loaders.push(load)
  return lazy(load)
}

export const LoginPage = page(() => import('@/features/auth/login-page'))
export const SetupPage = page(() => import('@/features/auth/setup-page'))
export const DashboardPage = page(() => import('@/features/dashboard/dashboard-page'))
export const MembersPage = page(() => import('@/features/members/members-page'))
export const CoursesPage = page(() => import('@/features/courses/courses-page'))
export const RosterPage = page(() => import('@/features/courses/roster-page'))
export const PlansPage = page(() => import('@/features/plans/plans-page'))
export const PaymentsPage = page(() => import('@/features/payments/payments-page'))
export const DailyReportPage = page(() => import('@/features/payments/daily-report-page'))
export const ExpensesPage = page(() => import('@/features/expenses/expenses-page'))
export const RemindersPage = page(() => import('@/features/reminders/reminders-page'))
export const AnalyticsPage = page(() => import('@/features/analytics/analytics-page'))
export const SettingsPage = page(() => import('@/features/settings/settings-page'))
export const GuidePage = page(() => import('@/features/onboarding/guide-page'))

let preloaded = false
export function preloadPages() {
  if (preloaded) return
  preloaded = true
  const run = () => loaders.forEach((load) => load().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}
