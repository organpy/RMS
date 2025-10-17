import { useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
import Select from '../components/ui/Select'
import { useAnalytics } from '../hooks/useAnalytics'
import { useBusiness } from '../context/BusinessContext'

const rangeOptions = [
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 18, label: 'Last 18 months' },
  { value: 24, label: 'Last 24 months' },
]

export default function Analytics() {
  const [months, setMonths] = useState(12)
  const { business } = useBusiness()
  const { data, loading, error, refresh } = useAnalytics({
    revenueMonths: months,
    revenueYears: 5,
    memberGrowthMonths: months,
    paymentTrendMonths: Math.min(months, 12),
    classPopularityLimit: 8,
  })

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: business?.currency ?? 'USD',
      }),
    [business?.currency],
  )

  const overview = useMemo(() => computeOverview(data), [data])

  if (loading && !data) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        variant="danger"
        title="Unable to load analytics"
        description={error.detail ?? error.message ?? 'Please try again later.'}
        actions={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
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
        </div>
      </section>

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
