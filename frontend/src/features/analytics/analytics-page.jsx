import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Download } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { PageHeader } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useParamsState } from '@/hooks/use-params-state'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { download } from '@/lib/download'
import { date, money, month, num } from '@/lib/format'
import { percentChange, PRESETS, presetRange } from '@/lib/ranges'

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`)

function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 text-muted-foreground">{month(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-medium tabular">
          {p.name}: {format(p.value)}
        </p>
      ))}
    </div>
  )
}

/** One headline figure with its change against the previous period of the same length. */
function Kpi({ label, value, current, previous, goodWhen = 'up', hint }) {
  const change = previous === undefined ? null : percentChange(current, previous)
  const good = change === null || change === 0 ? null : (change > 0) === (goodWhen === 'up')
  const Arrow = change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <p className={cn('mt-0.5 flex h-4 items-center gap-0.5 text-xs', good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-danger')}>
        {change !== null && (
          <>
            <Arrow className="size-3.5" />
            {Math.abs(Math.round(change * 100))}% vs previous
          </>
        )}
        {change === null && hint}
      </p>
    </Card>
  )
}

function Breakdown({ title, rows }) {
  const max = Math.max(...rows.map((r) => Number(r.revenue)), 1)
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="grid gap-3 px-5 pb-5">
        {rows.length === 0 && <li className="text-[13px] text-muted-foreground">No revenue in this period.</li>}
        {rows.map((r) => (
          <li key={r.name} className="grid gap-1.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <span className="truncate">{r.name}</span>
              <span className="font-medium tabular">{money(r.revenue)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(Number(r.revenue) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Forecast({ rows }) {
  return (
    <Card>
      <CardHeader title="Expected renewals" description="Coverage ending soon, at each member's plan price" />
      <div className="grid grid-cols-3 divide-x border-t">
        {rows.map((f) => (
          <div key={f.days} className="px-5 py-4">
            <p className="text-xs text-muted-foreground">Next {f.days} days</p>
            <p className="tabular mt-1 text-lg font-semibold">{money(f.amount)}</p>
            <p className="text-xs text-muted-foreground">
              {num(f.members)} member{f.members === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Aging({ rows }) {
  const max = Math.max(...rows.map((r) => r.members), 1)
  const total = rows.reduce((s, r) => s + r.members, 0)
  return (
    <Card>
      <CardHeader title="Overdue by age" description={total ? `${num(total)} members past their coverage end` : 'Nobody is past their coverage end'} />
      <ul className="grid gap-3 px-5 pb-5">
        {rows.map((r) => (
          <li key={r.label} className="grid gap-1.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <span>{r.label}</span>
              <span className="tabular text-muted-foreground">
                {num(r.members)} · <span className="font-medium text-foreground">{money(r.amount)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-danger/70" style={{ width: `${(r.members / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [params, patch] = useParamsState()
  const preset = params.range ?? '12'
  const [start, end] = preset === 'custom' ? [params.from, params.to] : presetRange(preset)
  const ready = Boolean(start && end && start <= end)
  const { data, error } = useQuery({
    queryKey: ['analytics', start, end],
    queryFn: () => api.get('/analytics', { start, end }),
    enabled: ready,
    retry: false,
  })

  const accent = css('--accent')
  const grid = css('--border')
  const muted = css('--muted-foreground')
  const ink = css('--foreground')
  const axis = { stroke: muted, fontSize: 12, tickLine: false, axisLine: false }
  const series = data?.months.map((m) => ({ ...m, revenue: Number(m.revenue), expenses: Number(m.expenses), profit: Number(m.profit) }))
  const k = data?.kpis

  return (
    <>
      <PageHeader title="Analytics" description={data ? `${date(data.start)} – ${date(data.end)}` : ' '}>
        <Select className="w-40" value={preset} onChange={(e) => patch({ range: e.target.value, from: null, to: null })} aria-label="Range">
          {PRESETS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {preset === 'custom' && (
          <>
            <Input type="date" className="w-40" value={params.from ?? ''} max={params.to || undefined} onChange={(e) => patch({ from: e.target.value })} aria-label="From" />
            <Input type="date" className="w-40" value={params.to ?? ''} min={params.from || undefined} onChange={(e) => patch({ to: e.target.value })} aria-label="To" />
          </>
        )}
        <Button variant="outline" disabled={!ready} onClick={() => download('/analytics/export.csv', { start, end }, 'analytics.csv')}>
          <Download /> Export
        </Button>
      </PageHeader>

      {error ? (
        <p className="text-[13px] text-danger">{error.message}</p>
      ) : !ready ? (
        <p className="text-[13px] text-muted-foreground">Choose a start and end date.</p>
      ) : !data ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Collected" value={money(k.collected)} current={k.collected} previous={k.collected_prev} />
            <Kpi label="Expenses" value={money(k.expenses)} current={k.expenses} previous={k.expenses_prev} goodWhen="down" />
            <Kpi label="Profit" value={money(k.profit)} current={k.profit} previous={k.profit_prev} />
            <Kpi label="Average per paying member" value={money(k.arpu)} hint={`${num(k.payments)} payments`} />
            <Kpi label="Active members" value={num(k.active_members)} hint="Covered at the end of the range" />
            <Kpi label="New members" value={num(k.new_members)} current={k.new_members} previous={k.new_members_prev} />
            <Kpi label="Lapsed members" value={num(k.churned)} goodWhen="down" hint={k.churn_rate === null ? 'Coverage ended, not renewed' : `${pct(k.churn_rate)} of covered members`} />
            <Kpi label="Collection rate" value={pct(k.collection_rate)} hint={k.attendance_rate === null ? 'Collected of charged' : `Attendance ${pct(k.attendance_rate)}`} />
          </div>

          <Card>
            <CardHeader title="Revenue, expenses and profit" description="Per month, refunds excluded" />
            <div className="h-72 px-2 pb-4">
              <ResponsiveContainer>
                <ComposedChart data={series} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="month" tickFormatter={month} {...axis} />
                  <YAxis tickFormatter={(v) => num(v)} width={56} {...axis} />
                  <Tooltip cursor={{ fill: grid, opacity: 0.4 }} content={<ChartTooltip format={money} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill={muted} fillOpacity={0.45} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line isAnimationActive={false} dataKey="profit" name="Profit" stroke={ink} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Members" description="Members with paid coverage, and new sign-ups" />
              <div className="h-80 px-2 pb-4">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="month" tickFormatter={month} {...axis} />
                    <YAxis allowDecimals={false} width={40} {...axis} />
                    <Tooltip content={<ChartTooltip format={num} />} />
                    <Line isAnimationActive={false} dataKey="active_members" name="Active" stroke={accent} strokeWidth={2} dot={false} />
                    <Line isAnimationActive={false} dataKey="new_members" name="New" stroke={muted} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <div className="grid content-start gap-4">
              <Forecast rows={data.forecast} />
              <Aging rows={data.aging} />
            </div>
            <Breakdown title="Revenue by payment method" rows={data.by_method} />
            <Breakdown title="Revenue by plan" rows={data.by_plan} />
            <Breakdown title="Revenue by course" rows={data.by_course} />
            <Breakdown title="Revenue by group" rows={data.by_group} />
          </div>
        </div>
      )}
    </>
  )
}
