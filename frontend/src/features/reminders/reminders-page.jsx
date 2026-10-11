import { BellRing, Check, Mail, MessageCircle, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/page'
import { Pagination } from '@/components/pagination'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { useOrg } from '@/features/organization/api'
import { useParamsState } from '@/hooks/use-params-state'
import { cn } from '@/lib/cn'
import { date, money, relativeDays } from '@/lib/format'

import { useLogReminders, useReminders } from './api'
import { canUse, reminderLink } from './links'

const SIZE = 25
const TABS = [
  ['', 'All'],
  ['overdue', 'Overdue'],
  ['due', 'Due'],
]
const CHANNELS = [
  ['email', 'Email', Mail],
  ['sms', 'SMS', MessageSquare],
  ['whatsapp', 'WhatsApp', MessageCircle],
]

export default function RemindersPage() {
  const [params, patch] = useParamsState()
  const page = Number(params.page ?? 1)
  const { data, isPending } = useReminders({ status: params.status, page, size: SIZE })
  const { data: org } = useOrg()
  const log = useLogReminders()
  const [selected, setSelected] = useState(() => new Set())
  const subject = `Payment reminder · ${org?.name ?? ''}`

  const send = (channel, item) => {
    window.open(reminderLink(channel, item, subject), channel === 'whatsapp' ? '_blank' : '_self', 'noopener')
    log.mutate({ member_ids: [item.member_id], channel })
  }
  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const chosen = data?.items.filter((i) => selected.has(i.member_id)) ?? []
  const emailAll = () => {
    const bcc = chosen.filter((i) => i.email).map((i) => i.email)
    window.open(`mailto:?bcc=${encodeURIComponent(bcc.join(','))}&subject=${encodeURIComponent(subject)}`, '_self')
    log.mutate({ member_ids: chosen.filter((i) => i.email).map((i) => i.member_id), channel: 'email' })
    setSelected(new Set())
  }

  return (
    <>
      <PageHeader title="Reminders" description="Members whose coverage has ended. Messages open on this device and are logged here.">
        <Link to="/settings#reminders" className="text-[13px] text-muted-foreground hover:text-foreground">
          Edit message template
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md bg-muted p-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => (patch({ status: value, page: null }), setSelected(new Set()))}
              className={cn('h-7 rounded px-3 text-[13px] text-muted-foreground', (params.status ?? '') === value && 'bg-background font-medium text-foreground shadow-sm')}
            >
              {label}
            </button>
          ))}
        </div>
        {chosen.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">{chosen.length} selected</span>
            <Button size="sm" variant="outline" onClick={emailAll} disabled={!chosen.some((i) => i.email)}>
              <Mail /> Email (BCC)
            </Button>
            <Button size="sm" variant="outline" onClick={() => (log.mutate({ member_ids: chosen.map((i) => i.member_id), channel: 'sms' }), setSelected(new Set()))}>
              <Check /> Mark reminded
            </Button>
          </div>
        )}
      </div>

      <Card>
        {isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={BellRing} title="All caught up" description="Nobody needs a reminder right now." />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="accent-accent"
                      checked={chosen.length === data.items.length}
                      onChange={(e) => setSelected(new Set(e.target.checked ? data.items.map((i) => i.member_id) : []))}
                    />
                  </TH>
                  <TH>Member</TH>
                  <TH className="hidden md:table-cell">Plan</TH>
                  <TH>Ended</TH>
                  <TH className="hidden sm:table-cell">Last reminded</TH>
                  <TH className="text-right">Send</TH>
                </TR>
              </THead>
              <tbody>
                {data.items.map((i) => (
                  <TR key={i.member_id}>
                    <TD>
                      <input type="checkbox" aria-label={`Select ${i.full_name}`} className="accent-accent" checked={selected.has(i.member_id)} onChange={() => toggle(i.member_id)} />
                    </TD>
                    <TD>
                      <Link to={`/members?open=${i.member_id}`} className="font-medium hover:underline">
                        {i.full_name}
                      </Link>
                      <div className="mt-0.5">
                        <StatusBadge status={i.status} />
                      </div>
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{i.plan_name ? `${i.plan_name} · ${money(i.amount)}` : '—'}</TD>
                    <TD className="whitespace-nowrap">
                      {i.paid_until ? (
                        <>
                          <p className="tabular">{date(i.paid_until)}</p>
                          <p className="text-xs text-muted-foreground">{relativeDays(i.paid_until)}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never paid</span>
                      )}
                    </TD>
                    <TD className="hidden text-muted-foreground sm:table-cell">{i.last_reminded_at ? date(i.last_reminded_at) : 'Never'}</TD>
                    <TD className="text-right whitespace-nowrap">
                      {CHANNELS.map(([channel, label, Icon]) => (
                        <Button key={channel} variant="ghost" size="icon" className="text-muted-foreground" title={label} aria-label={`${label} ${i.full_name}`} disabled={!canUse(channel, i)} onClick={() => send(channel, i)}>
                          <Icon />
                        </Button>
                      ))}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} size={SIZE} total={data.total} onPage={(n) => (patch({ page: n }), setSelected(new Set()))} />
          </>
        )}
      </Card>
    </>
  )
}
