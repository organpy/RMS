import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, FileText, MessageSquare, MoreHorizontal, Pencil, Receipt, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/api'
import { MessageHistory } from '@/features/messaging/message-history'
import { SendMessageDialog } from '@/features/messaging/send-dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { date, money, relativeDays } from '@/lib/format'

import { useDeleteMember, useMember, useSaveMember } from './api'
import { MemberFormDialog } from './member-form'

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children || '—'}</dd>
    </div>
  )
}

export function MemberSheet({ memberId, onClose }) {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: m } = useMember(memberId)
  const [editing, setEditing] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [tab, setTab] = useState('payments')
  const save = useSaveMember()
  const remove = useDeleteMember()
  const payments = useQuery({
    queryKey: ['payments', { member_id: memberId }],
    queryFn: () => api.get('/payments', { member_id: memberId, size: 10 }),
    enabled: !!memberId,
    placeholderData: undefined,
  })

  return (
    <>
      <Sheet open={!!memberId} onOpenChange={(o) => !o && onClose()} title={m?.full_name ?? 'Member'} description={m && [m.course_name, m.group_name].filter(Boolean).join(' · ')}>
        {!m ? (
          <div className="grid gap-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate(`/payments?new=1&member=${m.id}`)} disabled={m.status === 'archived'}>
                <Receipt /> Record payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="More actions" className="ml-auto">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setMessaging(true)}>
                    <MessageSquare /> Send message
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem onSelect={() => save.mutate({ id: m.id, archived: m.status !== 'archived' })}>
                    {m.status === 'archived' ? <ArchiveRestore /> : <Archive />}
                    {m.status === 'archived' ? 'Restore' : 'Archive'}
                  </MenuItem>
                  {me?.role === 'admin' && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        danger
                        onSelect={() => confirm(`Delete ${m.full_name} and all their payments? This cannot be undone.`) && remove.mutate(m.id, { onSuccess: onClose })}
                      >
                        <Trash2 /> Delete permanently
                      </MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            </div>

            <dl className="divide-y text-[13px]">
              <Row label="Status">
                <StatusBadge status={m.status} />
              </Row>
              <Row label="Paid until">{m.paid_until && `${date(m.paid_until)} (${relativeDays(m.paid_until)})`}</Row>
              <Row label="Plan">{m.plan_name && `${m.plan_name} · ${money(m.plan_price)}`}</Row>
              <Row label="Email">{m.email && <a href={`mailto:${m.email}`} className="hover:underline">{m.email}</a>}</Row>
              <Row label="Phone">{m.phone && <a href={`tel:${m.phone}`} className="hover:underline">{m.phone}</a>}</Row>
              <Row label="Joined">{date(m.joined_on)}</Row>
            </dl>
            {m.notes && <p className="rounded-lg bg-muted p-3 text-[13px] whitespace-pre-wrap">{m.notes}</p>}

            <section>
              <div role="tablist" aria-label="History" className="mb-2 flex gap-4 border-b text-[13px]">
                {['Payments', 'Messages'].map((label) => (
                  <button
                    key={label}
                    role="tab"
                    aria-selected={tab === label.toLowerCase()}
                    onClick={() => setTab(label.toLowerCase())}
                    className={cn('-mb-px border-b-2 border-transparent pb-2 text-muted-foreground', tab === label.toLowerCase() && 'border-foreground font-medium text-foreground')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'messages' ? (
                <MessageHistory memberId={m.id} />
              ) : (
                <>
                  {payments.data?.items.length === 0 && <p className="text-[13px] text-muted-foreground">No payments yet.</p>}
                  <ul className="divide-y rounded-lg border">
                    {payments.data?.items.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {date(p.paid_on)} · {p.invoice_number}
                          </p>
                        </div>
                        <span className={cn('tabular', p.refunded_at && 'text-muted-foreground line-through')}>{money(p.amount)}</span>
                        <a href={`/api/payments/${p.id}/invoice.pdf`} target="_blank" rel="noreferrer" className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Open invoice">
                          <FileText className="size-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}
      </Sheet>
      <MemberFormDialog open={editing} onOpenChange={setEditing} member={m} />
      <SendMessageDialog open={messaging} onOpenChange={setMessaging} target={{ member_ids: [memberId] }} title={`Message ${m?.first_name ?? ''}`} />
    </>
  )
}
