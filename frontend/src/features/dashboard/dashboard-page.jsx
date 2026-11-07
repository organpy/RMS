import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Plus, Receipt } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/api'
import { useSetupPending } from '@/features/onboarding/api'
import { SetupCard } from '@/features/onboarding/setup-card'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { date, money, num, relativeDays } from '@/lib/format'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Stat({ label, value, hint, to, tone }) {
  return (
    <Link to={to} className="group rounded-xl border p-4 transition-colors hover:bg-surface">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold sm:text-2xl tracking-tight tabular', tone)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  )
}

function Trend({ current, previous }) {
  if (!Number(previous)) return 'This month'
  const pct = Math.round(((current - previous) / previous) * 100)
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5', pct >= 0 ? 'text-success' : 'text-danger')}>
      <Icon className="size-3.5" />
      {Math.abs(pct)}% vs last month to date
    </span>
  )
}

function MemberRow({ member, detail }) {
  return (
    <Link to={`/members?open=${member.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{member.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">{member.plan_name ?? 'No plan'}</p>
      </div>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </Link>
  )
}

function List({ title, description, action, empty, children }) {
  const items = [children].flat().filter(Boolean)
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} description={description} action={action} />
      <div className="flex-1 border-t py-1">{items.length ? items : <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">{empty}</p>}</div>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') })
  const setupPending = useSetupPending()

  return (
    <>
      <PageHeader title={`${greeting()}, ${me?.name.split(' ')[0] ?? ''}`} description={date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}>
        <Button variant="outline" onClick={() => navigate('/members?new=1')}>
          <Plus /> New member
        </Button>
        <Button onClick={() => navigate('/payments?new=1')}>
          <Receipt /> Record payment
        </Button>
      </PageHeader>

      <SetupCard />

      {!data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat
              label="Revenue this month"
              value={money(data.revenue_month)}
              hint={<Trend current={data.revenue_month} previous={data.revenue_prev_month} />}
              to="/analytics"
            />
            <Stat label="Active members" value={num(data.counts.active)} hint={`${data.new_members_month} joined this month`} to="/members?status=active" />
            <Stat label="Due" value={num(data.counts.due)} hint="Within the grace period" to="/members?status=due" tone={data.counts.due ? 'text-warning' : ''} />
            <Stat label="Overdue" value={num(data.counts.overdue)} hint="Past the grace period" to="/reminders" tone={data.counts.overdue ? 'text-danger' : ''} />
          </div>

          {data.counts.active + data.counts.due + data.counts.overdue === 0 ? (
            !setupPending && <Card className="mt-6">
              <EmptyState title="No members yet" description="Create your courses and plans, then add your first member.">
                <Button onClick={() => navigate('/courses')}>Set up courses</Button>
              </EmptyState>
            </Card>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <List title="Expiring soon" description="Coverage ends within 7 days" empty="Nothing expiring this week">
                {data.expiring.map((m) => (
                  <MemberRow key={m.id} member={m} detail={relativeDays(m.paid_until)} />
                ))}
              </List>
              <List
                title="Overdue"
                description="Past the grace period"
                empty="Everyone is up to date"
                action={
                  data.overdue.length > 0 && (
                    <Link to="/reminders" className="text-[13px] font-medium text-accent hover:underline">
                      Remind
                    </Link>
                  )
                }
              >
                {data.overdue.map((m) => (
                  <MemberRow key={m.id} member={m} detail={<StatusBadge status="overdue" />} />
                ))}
              </List>
              <List
                title="Recent payments"
                description={`${data.payments_month} this month`}
                empty="No payments yet"
                action={
                  <Link to="/payments" className="text-[13px] font-medium text-accent hover:underline">
                    View all
                  </Link>
                }
              >
                {data.recent_payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.member_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.description} · {date(p.paid_on)}
                      </p>
                    </div>
                    <span className={cn('font-medium tabular', p.refunded_at && 'text-muted-foreground line-through')}>{money(p.amount)}</span>
                  </div>
                ))}
              </List>
            </div>
          )}
        </>
      )}
    </>
  )
}
