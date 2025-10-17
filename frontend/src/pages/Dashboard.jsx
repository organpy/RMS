import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { useDashboard } from '../hooks/useDashboard'
import { useBusiness } from '../context/BusinessContext'

const widgetLabels = [
  { key: 'active_members', label: 'Active Members' },
  { key: 'inactive_members', label: 'Inactive Members' },
  { key: 'suspended_members', label: 'Suspended Members' },
  { key: 'due_today', label: 'Due Today' },
  { key: 'overdue', label: 'Overdue Payments' },
  { key: 'overdue_inactive', label: 'Overdue & Inactive' },
]

export default function Dashboard() {
  const { business } = useBusiness()
  const { data, loading, error, refresh } = useDashboard({ alertsLimit: 5, recentLimit: 6, upcomingDays: 7 })

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
        title="Unable to load dashboard"
        description={error.detail ?? 'Please try again later.'}
        actions={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: business?.currency ?? 'USD',
  })

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Stay on top of member activity, payments, and upcoming renewals at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={refresh}>
            Refresh Data
          </Button>
          <Button size="sm">Record Payment</Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {widgetLabels.map(({ key, label }) => (
          <Card key={key} className="border border-transparent transition hover:border-primary/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{data.widgets?.[key] ?? 0}</p>
              </div>
              <Badge variant="info">Live</Badge>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Quick Stats"
          subtitle="Rollup of membership health and revenue insights"
          className="lg:col-span-2"
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total Members" value={data.quickStats?.total_members ?? 0} />
            <Stat label="Active Members" value={data.quickStats?.active_members ?? 0} />
            <Stat label="Due Today" value={data.quickStats?.due_today ?? 0} />
            <Stat label="Overdue" value={data.quickStats?.overdue ?? 0} />
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <Highlight
              label="Revenue (30 days)"
              value={currencyFormatter.format(Number(data.quickStats?.total_revenue_30_days ?? 0))}
            />
            <Highlight
              label="Upcoming Due Total"
              value={currencyFormatter.format(Number(data.quickStats?.upcoming_due_total ?? 0))}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Upcoming renewals</h3>
            <ul className="mt-3 space-y-2">
              {data.quickStats?.upcoming_due?.length ? (
                data.quickStats.upcoming_due.map((item) => (
                  <li
                    key={item.payment_id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{item.member_name}</p>
                      <p className="text-xs text-slate-500">
                        Due on {formatDate(item.next_due_date)} • {currencyFormatter.format(Number(item.amount))}
                      </p>
                    </div>
                      <Badge variant={item.status === 'OVERDUE' ? 'danger' : 'warning'}>{item.status}</Badge>
                  </li>
                ))
              ) : (
                <p className="text-sm text-slate-500">No upcoming renewals within the selected window.</p>
              )}
            </ul>
          </div>
        </Card>
        <Card title="Payment Alerts" subtitle="Due today and overdue members requiring attention">
          <div className="space-y-4">
            <AlertList title="Due today" items={data.alerts?.due_today ?? []} formatter={currencyFormatter} />
            <AlertList title="Overdue" items={data.alerts?.overdue ?? []} formatter={currencyFormatter} />
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent Activity" subtitle="Latest payments and membership updates">
          <ul className="space-y-3">
            {data.recentActivity?.payments?.length ? (
              data.recentActivity.payments.map((item) => (
                <li
                  key={item.payment_id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.member_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.class_name ?? 'General membership'} • {formatDate(item.payment_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {currencyFormatter.format(Number(item.amount))}
                    </p>
                    <Badge variant={badgeVariantForStatus(item.status)}>{item.status}</Badge>
                  </div>
                </li>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent activity recorded.</p>
            )}
          </ul>
        </Card>
        <Card title="Next actions" subtitle="Recommended tasks to stay ahead">
          <div className="space-y-4 text-sm text-slate-600">
            <ActionItem
              title="Review overdue accounts"
              description="Follow up with members whose payments are past due to keep revenue on track."
            />
            <ActionItem
              title="Send renewal reminders"
              description="Notify members with upcoming due dates to improve on-time payments."
            />
            <ActionItem
              title="Publish new classes"
              description="Keep your schedule fresh by adding upcoming classes and sessions."
            />
          </div>
        </Card>
      </section>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function Highlight({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function AlertList({ title, items, formatter }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.payment_id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.member_name}</p>
                <p className="text-xs text-slate-500">
                  Due {formatDate(item.next_due_date)} • {formatter.format(Number(item.amount))}
                </p>
              </div>
              <Badge variant={badgeVariantForStatus(item.status)}>{item.status}</Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Nothing to show.</p>
        )}
      </div>
    </div>
  )
}

function ActionItem({ title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  )
}

function badgeVariantForStatus(status) {
  switch (status) {
    case 'PAID':
      return 'success'
    case 'OVERDUE':
      return 'danger'
    case 'UNPAID':
    default:
      return 'warning'
  }
}

function formatDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return parsed.toLocaleDateString()
}
