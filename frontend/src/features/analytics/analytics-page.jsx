import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { PageHeader } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useParamsState } from '@/hooks/use-params-state'
import { api } from '@/lib/api'
import { download } from '@/lib/download'
import { money, month, num } from '@/lib/format'

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

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

export default function AnalyticsPage() {
  const [params, patch] = useParamsState()
  const months = Number(params.months ?? 12)
  const { data } = useQuery({ queryKey: ['analytics', months], queryFn: () => api.get('/analytics', { months }) })

  const accent = css('--accent')
  const grid = css('--border')
  const muted = css('--muted-foreground')
  const axis = { stroke: muted, fontSize: 12, tickLine: false, axisLine: false }
  const series = data?.months.map((m) => ({ ...m, revenue: Number(m.revenue) }))
  const total = series?.reduce((s, m) => s + m.revenue, 0) ?? 0
  const payments = series?.reduce((s, m) => s + m.payments, 0) ?? 0

  return (
    <>
      <PageHeader title="Analytics" description={data ? `${money(total)} from ${num(payments)} payments · ${money(total / months)} per month on average` : ' '}>
        <Select className="w-36" value={months} onChange={(e) => patch({ months: e.target.value })} aria-label="Range">
          {[6, 12, 24, 36].map((n) => (
            <option key={n} value={n}>
              Last {n} months
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => download('/analytics/export.csv', { months }, 'analytics.csv')}>
          <Download /> Export
        </Button>
      </PageHeader>

      {!data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Revenue" description="Collected per month, refunds excluded" />
            <div className="h-64 px-2 pb-4">
              <ResponsiveContainer>
                <BarChart data={series} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="month" tickFormatter={month} {...axis} />
                  <YAxis tickFormatter={(v) => num(v)} width={56} {...axis} />
                  <Tooltip cursor={{ fill: grid, opacity: 0.4 }} content={<ChartTooltip format={money} />} />
                  <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardHeader title="Members" description="Members with paid coverage, and new sign-ups" />
            <div className="h-64 px-2 pb-4">
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
          <Breakdown title="Revenue by plan" rows={data.by_plan} />
          <Breakdown title="Revenue by course" rows={data.by_course} />
        </div>
      )}
    </>
  )
}
