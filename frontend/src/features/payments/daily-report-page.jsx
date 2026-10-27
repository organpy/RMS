import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'

import { PageHeader } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useParamsState } from '@/hooks/use-params-state'
import { api } from '@/lib/api'
import { date, money, today } from '@/lib/format'

import { PaymentsTabs } from './payments-tabs'

const METHODS = [
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['transfer', 'Transfer'],
  ['other', 'Other'],
]

const useDaily = (day) => useQuery({ queryKey: ['reports', 'daily', day], queryFn: () => api.get('/reports/daily', { day }) })

function Lines({ lines, empty }) {
  if (!lines.length) return <p className="px-4 py-5 text-[13px] text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y">
      {lines.map((l) => (
        <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{l.member_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {l.invoice_number} · {l.description}
              {l.staff_name && ` · ${l.staff_name}`}
            </p>
          </div>
          <span className="text-xs text-muted-foreground capitalize">{l.method}</span>
          <span className="tabular w-20 text-right">{money(l.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function DailyReportPage() {
  const [params, patch] = useParamsState()
  const day = params.date ?? today()
  const { data } = useDaily(day)

  return (
    <>
      <PageHeader title="Payments" description={`Cash-up for ${date(day)}`}>
        <Input type="date" aria-label="Report date" className="w-40 print:hidden" value={day} max={today()} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
        <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </PageHeader>
      <PaymentsTabs />

      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4 lg:col-span-1">
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="tabular mt-1 text-xl font-semibold">{money(data.total)}</p>
              <p className="text-xs text-muted-foreground">
                {data.count} payment{data.count === 1 ? '' : 's'}
              </p>
            </Card>
            {METHODS.map(([value, label]) => (
              <Card key={value} className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="tabular mt-1 text-xl font-semibold">{money(data.by_method[value] ?? 0)}</p>
              </Card>
            ))}
          </div>

          {data.by_staff.length > 0 && (
            <Card>
              <h2 className="border-b px-4 py-3 text-[13px] font-medium">By staff</h2>
              <ul className="divide-y">
                {data.by_staff.map((s) => (
                  <li key={s.staff_name ?? 'none'} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="flex-1 font-medium">{s.staff_name ?? 'Unknown'}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {METHODS.filter(([m]) => s.by_method[m]).map(([m, label]) => `${label} ${money(s.by_method[m])}`).join(' · ')}
                    </span>
                    <span className="tabular w-24 text-right font-medium">{money(s.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="border-b px-4 py-3 text-[13px] font-medium">Payments</h2>
            <Lines lines={data.payments} empty="Nothing collected on this day." />
          </Card>

          {data.refunds.length > 0 && (
            <Card>
              <h2 className="flex justify-between border-b px-4 py-3 text-[13px] font-medium">
                <span>Refunded</span>
                <span className="tabular text-danger">−{money(data.refunded_total)}</span>
              </h2>
              <Lines lines={data.refunds} />
            </Card>
          )}
        </div>
      )}
    </>
  )
}
