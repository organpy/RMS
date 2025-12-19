import { useCallback, useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
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
          <TrendList
            data={data?.monthlyRevenue?.data ?? []}
            formatter={(value) => currencyFormatter.format(Number(value ?? 0))}
          />
        </Card>
        <Card title="Member growth" subtitle="New members added per month">
          <TrendList data={data?.memberGrowth?.data ?? []} formatter={(value) => formatNumber(value)} />
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Payment trends" subtitle="Breakdown of payment statuses by month">
          <Table
            columns={[
              { key: 'period', header: 'Period' },
              { key: 'paid', header: 'Paid', render: (row) => formatNumber(row.paid) },
              { key: 'unpaid', header: 'Pending', render: (row) => formatNumber(row.unpaid) },
              { key: 'overdue', header: 'Overdue', render: (row) => formatNumber(row.overdue) },
              { key: 'refunded', header: 'Refunded', render: (row) => formatNumber(row.refunded) },
              {
                key: 'ratio',
                header: 'Overdue %',
                render: (row) => formatPercent(calculateRatio(row.overdue, row.totalVolume)),
              },
            ]}
            data={withPaymentMeta(data?.paymentTrends?.data ?? [])}
            emptyState={{
              title: 'No payment trend data',
              description: 'Record payments to populate monthly trends.',
            }}
          />
        </Card>
        <Card title="Popular classes" subtitle="Most attended classes across the selected range">
          <Table
            columns={[
              { key: 'position', header: '#', render: (row) => row.position },
              { key: 'class_name', header: 'Class', render: (row) => row.class_name },
              {
                key: 'member_count',
                header: 'Members',
                render: (row) => (
                  <Badge variant="info" className="text-xs">
                    {formatNumber(row.member_count)}
                  </Badge>
                ),
              },
            ]}
            data={(data?.classPopularity?.data ?? []).map((row, index) => ({
              ...row,
              position: index + 1,
            }))}
            emptyState={{
              title: 'No class data yet',
              description: 'Classes will appear once members are registered.',
            }}
          />
        </Card>
      </section>

      <Card title="Yearly revenue" subtitle="Cumulative totals for the last five years">
        <Table
          columns={[
            { key: 'period', header: 'Year' },
            { key: 'total', header: 'Revenue', render: (row) => currencyFormatter.format(Number(row.total ?? 0)) },
          ]}
          data={data?.yearlyRevenue?.data ?? []}
          emptyState={{
            title: 'No yearly revenue data',
            description: 'Export analytics after recording payments to view annual summaries.',
          }}
        />
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

function TrendList({ data, formatter }) {
  if (!data.length) {
    return <p className="text-sm text-slate-500">No data in this range yet.</p>
  }

  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li
          key={item.period}
          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
        >
          <span className="font-medium text-slate-700">{item.period}</span>
          <span className="text-slate-900">{formatter(item.total ?? item.value ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
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
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? (
        <p className="text-xs text-slate-400">
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
