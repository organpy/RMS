import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, CreditCard, Filter, UserPlus } from 'lucide-react'

import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Skeleton } from '../components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { useDashboard } from '../hooks/useDashboard'
import { useBusiness } from '../context/BusinessContext'
import { useToast } from '@/hooks/use-toast'
import { emitCommand } from '@/lib/commandBus'

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
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const alertsShownRef = useRef(false)
  const [isAlertsOpen, setAlertsOpen] = useState(false)

  const { data, loading, error, refresh, isFetching } = useDashboard({
    alertsLimit: 5,
    recentLimit: 6,
    upcomingDays: 7,
    autoRefresh: true,
  })

  const isRefreshing = isFetching && Boolean(data)

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: business?.currency ?? 'USD',
      }),
    [business?.currency],
  )

  const totalAlerts = useMemo(() => {
    const dueToday = data?.alerts?.due_today?.length ?? 0
    const overdue = data?.alerts?.overdue?.length ?? 0
    return dueToday + overdue
  }, [data?.alerts])

  useEffect(() => {
    if (!alertsShownRef.current && totalAlerts > 0) {
      alertsShownRef.current = true
      setAlertsOpen(true)
    }
  }, [totalAlerts])

  if (loading && !data) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load dashboard</AlertTitle>
            <AlertDescription>{error.detail ?? 'Please try again later.'}</AlertDescription>
          </Alert>
          <Button onClick={refresh}>Retry</Button>
        </div>
      </div>
    )
  }

  const handleNavigateWithCommand = (path, command, detail = {}) => {
    const isSameRoute = path ? location.pathname === path : false

    if (command) {
      emitCommand(command, detail, isSameRoute ? {} : { persist: true })
    }

    if (path && !isSameRoute) {
      navigate(path)
    }
  }

  const quickActions = [
    {
      id: 'add-member',
      label: 'Add a member',
      description: 'Capture a new registration without leaving the dashboard.',
      icon: UserPlus,
      path: '/members',
      command: 'members.openCreate',
      toast: {
        title: 'Member form queued',
        description: 'The members page will open with the new member dialog ready.',
      },
    },
    {
      id: 'record-payment',
      label: 'Record a payment',
      description: 'Jump straight into recording a payment and generating a receipt.',
      icon: CreditCard,
      path: '/payments',
      command: 'payments.openCreate',
      toast: {
        title: 'Payment dialog ready',
        description: 'The payments view will open with the record payment form.',
      },
    },
    {
      id: 'review-overdue',
      label: 'Review overdue invoices',
      description: 'See who needs follow up and send reminders in one place.',
      icon: BellRing,
      path: '/payments',
      command: 'payments.filterStatus',
      detail: {
        status: 'OVERDUE',
        message: 'Showing overdue payments from the dashboard quick action.',
      },
      toast: {
        title: 'Overdue filter applied',
        description: 'Payments will load filtered to overdue invoices.',
      },
    },
    {
      id: 'check-suspended',
      label: 'Check suspended members',
      description: 'Follow up with members whose access is currently paused.',
      icon: Filter,
      path: '/members',
      command: 'members.filterStatus',
      detail: {
        status: 'SUSPENDED',
        message: 'Showing suspended members from the dashboard quick action.',
      },
      toast: {
        title: 'Suspended members queued',
        description: 'Members will load filtered to suspended accounts.',
      },
    },
  ]

  const widgetActions = {
    active_members: {
      path: '/members',
      command: 'members.filterStatus',
      detail: { status: 'ACTIVE', message: 'Showing active members from the dashboard widget.' },
      toast: {
        title: 'Active members filtered',
        description: 'Members will load showing active accounts first.',
      },
    },
    inactive_members: {
      path: '/members',
      command: 'members.filterStatus',
      detail: { status: 'INACTIVE', message: 'Showing inactive members from the dashboard widget.' },
      toast: {
        title: 'Inactive members filtered',
        description: 'Members will load showing inactive accounts.',
      },
    },
    suspended_members: {
      path: '/members',
      command: 'members.filterStatus',
      detail: { status: 'SUSPENDED', message: 'Showing suspended members from the dashboard widget.' },
      toast: {
        title: 'Suspended members filtered',
        description: 'Members will focus on suspended accounts.',
      },
    },
    due_today: {
      path: '/payments',
      command: 'payments.filterStatus',
      detail: {
        status: 'PENDING',
        period: 1,
        message: 'Showing payments due today from the dashboard widget.',
      },
      toast: {
        title: 'Payments due today',
        description: 'Payments will load filtered to invoices due today.',
      },
    },
    overdue: {
      path: '/payments',
      command: 'payments.filterStatus',
      detail: {
        status: 'OVERDUE',
        message: 'Showing overdue payments from the dashboard widget.',
      },
      toast: {
        title: 'Overdue payments filtered',
        description: 'Payments will load filtered to overdue invoices.',
      },
    },
    overdue_inactive: {
      path: '/members',
      command: 'members.filterStatus',
      detail: {
        status: 'SUSPENDED',
        message: 'Showing suspended members who may be overdue.',
      },
      toast: {
        title: 'Suspended members queued',
        description: 'Members will focus on accounts needing outreach.',
      },
    },
  }

  const runQuickAction = (action) => {
    if (!action) return
    handleNavigateWithCommand(action.path, action.command, action.detail ?? {})
    const message = action.toast ?? {
      title: 'Quick action ready',
      description: action.description,
    }
    toast(message)
  }

  const handleWidgetClick = (key) => {
    const action = widgetActions[key]
    if (!action) return
    handleNavigateWithCommand(action.path, action.command, action.detail ?? {})
    if (action.toast) {
      toast(action.toast)
    }
  }

  const recordPaymentAction = quickActions.find((action) => action.id === 'record-payment')

  const dueTodayAlerts = data?.alerts?.due_today ?? []
  const overdueAlerts = data?.alerts?.overdue ?? []

  return (
    <div className="space-y-8">
      <AlertsDialog
        open={isAlertsOpen && totalAlerts > 0}
        onOpenChange={setAlertsOpen}
        alerts={data?.alerts}
        formatter={currencyFormatter}
        onViewDue={() => handleWidgetClick('due_today')}
        onViewOverdue={() => handleWidgetClick('overdue')}
      />

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
          <Button size="sm" onClick={() => runQuickAction(recordPaymentAction)}>Record Payment</Button>
        </div>
      </section>

      {isRefreshing ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Spinner size="sm" className="text-primary" />
          Updating insights…
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {widgetLabels.map(({ key, label }) => (
          <Card
            key={key}
            className={widgetActions[key] ? 'border border-transparent transition hover:border-primary/50' : undefined}
          >
            <div
              role={widgetActions[key] ? 'button' : undefined}
              tabIndex={widgetActions[key] ? 0 : undefined}
              onClick={widgetActions[key] ? () => handleWidgetClick(key) : undefined}
              onKeyDown={
                widgetActions[key]
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleWidgetClick(key)
                      }
                    }
                  : undefined
              }
              className={
                widgetActions[key]
                  ? 'flex items-center justify-between rounded-xl border border-transparent p-1 outline-none transition focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40'
                  : 'flex items-center justify-between'
              }
            >
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{data.widgets?.[key] ?? 0}</p>
              </div>
              <Badge variant="info">Live</Badge>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-4">
        <QuickActionsCard actions={quickActions} onRunAction={runQuickAction} />
        <Card
          title="Quick Stats"
          subtitle="Rollup of membership health and revenue insights"
          className="xl:col-span-2"
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
        <Card
          header={
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Payment Alerts</h2>
                <p className="text-sm text-slate-500">Due today and overdue members requiring attention</p>
              </div>
              {totalAlerts > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-none hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
                  onClick={() => setAlertsOpen(true)}
                >
                  View all
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="space-y-4">
            <AlertList title="Due today" items={dueTodayAlerts} formatter={currencyFormatter} />
            <AlertList title="Overdue" items={overdueAlerts} formatter={currencyFormatter} />
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

function QuickActionsCard({ actions, onRunAction }) {
  return (
    <Card
      title="Quick actions"
      subtitle="Jump into frequent workflows without digging through menus."
      className="xl:order-first"
    >
      <ul className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <li key={action.id}>
              <Button
                variant="ghost"
                size="lg"
                className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white py-5 text-left text-sm font-semibold text-slate-900 shadow-none hover:border-primary/60 hover:bg-primary/5"
                onClick={() => onRunAction(action)}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="block text-left">
                    <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                    <span className="mt-1 block text-xs font-normal text-slate-500">{action.description}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-primary" />
              </Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function AlertsDialog({ open, onOpenChange, alerts, formatter, onViewDue, onViewOverdue }) {
  const dueToday = alerts?.due_today ?? []
  const overdue = alerts?.overdue ?? []
  const hasAlerts = Boolean(dueToday.length || overdue.length)

  return (
    <Dialog open={open && hasAlerts} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Members that need attention</DialogTitle>
          <DialogDescription>
            Follow up with these members to keep renewals and payments on schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <AlertList title="Due today" items={dueToday} formatter={formatter} />
          <AlertList title="Overdue" items={overdue} formatter={formatter} />
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {dueToday.length > 0 ? (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onViewDue}>
              View due today
            </Button>
          ) : null}
          {overdue.length > 0 ? (
            <Button className="w-full sm:w-auto" onClick={onViewOverdue}>
              Review overdue
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-5 w-16" />
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </Card>
        <Card className="space-y-4">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="space-y-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((__, innerIndex) => (
              <Skeleton key={innerIndex} className="h-12 w-full" />
            ))}
          </Card>
        ))}
      </section>
    </div>
  )
}
