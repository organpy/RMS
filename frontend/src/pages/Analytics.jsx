import { useCallback, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Select from '../components/ui/Select'
import { Skeleton } from '../components/ui/skeleton'
import { useAnalytics } from '../hooks/useAnalytics'
import { useBusiness } from '../context/BusinessContext'
import { useToast } from '@/hooks/use-toast'
import api from '../services/api'

const rangeOptions = [
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 18, label: 'Last 18 months' },
  { value: 24, label: 'Last 24 months' },
]

export default function Analytics() {
  const [months, setMonths] = useState(12)
  const { business } = useBusiness()
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const { data, loading, error, refresh, isFetching } = useAnalytics({
    revenueMonths: months,
    revenueYears: 5,
    memberGrowthMonths: months,
    paymentTrendMonths: Math.min(months, 12),
    classPopularityLimit: 8,
  })

  const handleExportAnalytics = useCallback(async () => {
    try {
      setIsExporting(true)
      const response = await api.get('/api/analytics/export', { responseType: 'blob' })
      const blob = response.data
      const filename = extractFilename(response.headers?.['content-disposition']) ?? `analytics-${new Date().toISOString().slice(0, 10)}.csv`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Export ready',
        description: `Downloaded ${filename}.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error?.detail ?? 'Unable to generate the analytics export right now.',
      })
    } finally {
      setIsExporting(false)
    }
  }, [toast])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: business?.currency ?? 'USD',
      }),
    [business?.currency],
  )

  const overview = useMemo(() => computeOverview(data), [data])

  const chartColors = useMemo(
    () => [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
    ],
    [],
  )

  const monthlyRevenueSeries = useMemo(
    () =>
      (data?.monthlyRevenue?.data ?? []).map((point) => ({
        period: point.period,
        total: Number(point.total ?? 0),
      })),
    [data],
  )

  const memberGrowthSeries = useMemo(
    () =>
      (data?.memberGrowth?.data ?? []).map((point) => ({
        period: point.period,
        total: Number(point.total ?? point.value ?? 0),
      })),
    [data],
  )

  const paymentTrendSeries = useMemo(() => {
    const rows = withPaymentMeta(data?.paymentTrends?.data ?? [])
    return rows.map((row) => ({
      ...row,
      paid: Number(row.paid ?? 0),
      unpaid: Number(row.unpaid ?? 0),
      overdue: Number(row.overdue ?? 0),
      refunded: Number(row.refunded ?? 0),
      overdueRatio: calculateRatio(Number(row.overdue ?? 0), Number(row.totalVolume ?? 0)),
    }))
  }, [data])

  const classPopularitySeries = useMemo(
    () =>
      (data?.classPopularity?.data ?? []).map((row) => ({
        name: row.class_name,
        value: Number(row.member_count ?? 0),
      })),
    [data],
  )

  const yearlyRevenueSeries = useMemo(
    () =>
      (data?.yearlyRevenue?.data ?? []).map((point) => ({
        period: point.period,
        total: Number(point.total ?? 0),
      })),
    [data],
  )

  const isRefreshing = isFetching && Boolean(data)

  if (loading && !data) {
    return <AnalyticsSkeleton />
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load analytics</AlertTitle>
            <AlertDescription>{error.detail ?? error.message ?? 'Please try again later.'}</AlertDescription>
          </Alert>
          <Button onClick={refresh}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track revenue performance, membership growth, and class engagement over time.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={months} onChange={(event) => setMonths(Number(event.target.value))}>
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportAnalytics} disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </section>

      {isRefreshing ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Spinner size="sm" className="text-primary" />
          Refreshing analytics…
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Latest monthly revenue"
          value={currencyFormatter.format(overview.latestMonthlyRevenue)}
          hint={overview.latestMonthLabel}
        />
        <StatCard
          label="Revenue (selected range)"
          value={currencyFormatter.format(overview.rangeRevenue)}
          hint={`${months} months cumulative`}
        />
        <StatCard
          label="New members (latest month)"
          value={formatNumber(overview.latestMemberGrowth)}
          hint={overview.latestMemberMonth}
        />
        <StatCard
          label="Overdue payments ratio"
          value={formatPercent(overview.latestOverdueRatio)}
          hint={overview.latestPaymentMonth}
          variant={overview.latestOverdueRatio > 0.15 ? 'danger' : 'info'}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Monthly revenue trend" subtitle={`Last ${months} months`}>
          <ChartFrame>
            {monthlyRevenueSeries.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyRevenueSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => currencyFormatter.format(Number(value ?? 0))}
                    width={84}
                  />
                  <Tooltip
                    formatter={(value) => [currencyFormatter.format(Number(value ?? 0)), 'Revenue']}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={chartColors[0]}
                    fill={chartColors[0]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState description="No revenue in this range yet." />
            )}
          </ChartFrame>
        </Card>
        <Card title="Member growth" subtitle="New members added per month">
          <ChartFrame>
            {memberGrowthSeries.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={memberGrowthSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={56} />
                  <Tooltip
                    formatter={(value) => [formatNumber(value), 'New members']}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={chartColors[1]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState description="No member growth in this range yet." />
            )}
          </ChartFrame>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Payment trends" subtitle="Breakdown of payment statuses by month">
          <ChartFrame>
            {paymentTrendSeries.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={paymentTrendSeries} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis yAxisId="counts" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={56} />
                  <YAxis
                    yAxisId="ratio"
                    orientation="right"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => formatPercent(value)}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'overdueRatio') return [formatPercent(value), 'Overdue %']
                      return [formatNumber(value), String(name)]
                    }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="counts" dataKey="paid" stackId="a" name="Paid" fill={chartColors[1]} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="counts" dataKey="unpaid" stackId="a" name="Pending" fill={chartColors[3]} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="counts" dataKey="overdue" stackId="a" name="Overdue" fill={chartColors[4]} radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="ratio"
                    type="monotone"
                    dataKey="overdueRatio"
                    name="Overdue %"
                    stroke={chartColors[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState description="Record payments to populate monthly trends." />
            )}
          </ChartFrame>
        </Card>
        <Card title="Popular classes" subtitle="Most attended classes across the selected range">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <ChartFrame className="lg:order-1">
              {classPopularitySeries.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Tooltip
                      formatter={(value) => [formatNumber(value), 'Members']}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Pie
                      data={classPopularitySeries}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={100}
                      paddingAngle={2}
                      stroke="hsl(var(--background))"
                    >
                      {classPopularitySeries.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState description="Classes will appear once members are registered." />
              )}
            </ChartFrame>

            <div className="space-y-2">
              {classPopularitySeries.length ? (
                <ul className="space-y-2">
                  {classPopularitySeries.map((entry, index) => (
                    <li
                      key={entry.name}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        <span className="text-sm font-medium text-foreground">{entry.name}</span>
                      </div>
                      <Badge variant="info" className="text-xs">
                        {formatNumber(entry.value)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      <Card title="Yearly revenue" subtitle="Cumulative totals for the last five years">
        <ChartFrame>
          {yearlyRevenueSeries.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearlyRevenueSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => currencyFormatter.format(Number(value ?? 0))}
                  width={84}
                />
                <Tooltip
                  formatter={(value) => [currencyFormatter.format(Number(value ?? 0)), 'Revenue']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar dataKey="total" fill={chartColors[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState description="Export analytics after recording payments to view annual summaries." />
          )}
        </ChartFrame>
      </Card>
    </div>
  )
}

function computeOverview(data) {
  const monthlyRevenue = data?.monthlyRevenue?.data ?? []
  const memberGrowth = data?.memberGrowth?.data ?? []
  const paymentTrends = data?.paymentTrends?.data ?? []

  const latestMonthly = monthlyRevenue.at(-1)
  const rangeRevenue = monthlyRevenue.reduce((sum, point) => sum + Number(point.total ?? 0), 0)

  const latestMember = memberGrowth.at(-1)
  const latestPayment = paymentTrends.at(-1)

  const latestPaymentTotal = latestPayment
    ? latestPayment.paid + latestPayment.unpaid + latestPayment.overdue
    : 0

  return {
    latestMonthlyRevenue: Number(latestMonthly?.total ?? 0),
    latestMonthLabel: latestMonthly?.period ?? '—',
    rangeRevenue,
    latestMemberGrowth: Number(latestMember?.total ?? 0),
    latestMemberMonth: latestMember?.period ?? '—',
    latestOverdueRatio: calculateRatio(latestPayment?.overdue ?? 0, latestPaymentTotal),
    latestPaymentMonth: latestPayment?.period ?? '—',
  }
}

function ChartFrame({ children, className }) {
  return (
    <div
      className={['rounded-xl border border-border bg-muted/10 p-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

function ChartEmptyState({ description }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{description}</p>
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--foreground))',
}

const tooltipLabelStyle = {
  color: 'hsl(var(--muted-foreground))',
}

function withPaymentMeta(data) {
  return data.map((row) => ({
    ...row,
    id: row.period,
    totalVolume: row.paid + row.unpaid + row.overdue,
  }))
}

function calculateRatio(part, total) {
  if (!total) return 0
  return part / total
}

function formatPercent(value) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0%'
  return `${(numeric * 100).toFixed(1)}%`
}

function formatNumber(value) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat().format(numeric)
}

function StatCard({ label, value, hint, variant = 'info' }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? (
        <p className="text-xs text-muted-foreground">
          <Badge variant={variant} className="mr-1 align-middle">
            {hint}
          </Badge>
        </p>
      ) : null}
    </Card>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-20" />
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="space-y-4">
            <Skeleton className="h-3 w-40" />
            {Array.from({ length: 5 }).map((__, innerIndex) => (
              <Skeleton key={innerIndex} className="h-10 w-full" />
            ))}
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="space-y-4">
            <Skeleton className="h-3 w-40" />
            {Array.from({ length: 6 }).map((__, innerIndex) => (
              <Skeleton key={innerIndex} className="h-8 w-full" />
            ))}
          </Card>
        ))}
      </section>

      <Card className="space-y-4">
        <Skeleton className="h-3 w-40" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </Card>
    </div>
  )
}

function extractFilename(disposition) {
  if (!disposition) return null
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match ? match[1] : null
}
