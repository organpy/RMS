import { Download, FileText, Mail, MoreHorizontal, Plus, Receipt, Search, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/page'
import { Pagination } from '@/components/pagination'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { useMessagingStatus } from '@/features/messaging/api'
import { useDebounced } from '@/hooks/use-debounced'
import { useParamsState } from '@/hooks/use-params-state'
import { cn } from '@/lib/cn'
import { download } from '@/lib/download'
import { date, money } from '@/lib/format'

import { invoiceUrl, useEmailInvoice, usePayments, useRefund } from './api'
import { PaymentDialog } from './payment-dialog'
import { PaymentsTabs } from './payments-tabs'

const SIZE = 25
const METHOD = { cash: 'Cash', card: 'Card', transfer: 'Transfer', other: 'Other' }

export default function PaymentsPage() {
  const [params, patch] = useParamsState()
  const [search, setSearch] = useState(params.q ?? '')
  const q = useDebounced(search.trim())
  const page = Number(params.page ?? 1)
  const filters = { q, method: params.method, from: params.from, to: params.to }
  const { data, isPending } = usePayments({ ...filters, page, size: SIZE })
  const refund = useRefund()
  const email = useEmailInvoice()
  const { data: messaging } = useMessagingStatus()

  useEffect(() => {
    if (q !== (params.q ?? '')) patch({ q, page: null })
  }, [q, params.q, patch])

  const filtered = Boolean(q || params.method || params.from || params.to)

  return (
    <>
      <PageHeader title="Payments" description={data ? `${data.total.toLocaleString()} payments · ${money(data.amount_total)} collected` : ' '}>
        <Button variant="outline" onClick={() => download('/payments/export.csv', filters, 'payments.csv')}>
          <Download /> Export
        </Button>
        <Button onClick={() => patch({ new: 1 })}>
          <Plus /> Record payment
        </Button>
      </PageHeader>

      <PaymentsTabs />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member or invoice number" className="pl-9" />
        </div>
        <Select className="w-36" value={params.method ?? ''} onChange={(e) => patch({ method: e.target.value, page: null })} aria-label="Method">
          <option value="">All methods</option>
          {Object.entries(METHOD).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input type="date" className="w-40" value={params.from ?? ''} onChange={(e) => patch({ from: e.target.value, page: null })} aria-label="From" />
        <Input type="date" className="w-40" value={params.to ?? ''} onChange={(e) => patch({ to: e.target.value, page: null })} aria-label="To" />
      </div>

      <Card>
        {isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={Receipt} title={filtered ? 'No matching payments' : 'No payments yet'} description={filtered ? 'Try a different search or date range.' : 'Recorded payments and their invoices show up here.'}>
            {!filtered && <Button onClick={() => patch({ new: 1 })}>Record payment</Button>}
          </EmptyState>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className="hidden sm:table-cell">Date</TH>
                  <TH>Member</TH>
                  <TH className="hidden md:table-cell">Description</TH>
                  <TH className="hidden sm:table-cell">Method</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <tbody>
                {data.items.map((p) => (
                  <TR key={p.id} className={cn(p.refunded_at && 'text-muted-foreground')}>
                    <TD className="hidden whitespace-nowrap tabular sm:table-cell">{date(p.paid_on)}</TD>
                    <TD>
                      <Link to={`/members?open=${p.member_id}`} className="font-medium hover:underline">
                        {p.member_name}
                      </Link>
                      <p className="text-xs text-muted-foreground tabular sm:hidden">
                        {date(p.paid_on)} · {METHOD[p.method]}
                      </p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p>{p.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.invoice_number}
                        {p.period_start && ` · ${date(p.period_start)} – ${date(p.period_end)}`}
                      </p>
                    </TD>
                    <TD className="hidden text-muted-foreground sm:table-cell">{METHOD[p.method]}</TD>
                    <TD className="text-right whitespace-nowrap">
                      {p.refunded_at && <StatusBadge status="refunded" />}{' '}
                      <span className={cn('font-medium tabular', p.refunded_at && 'line-through')}>{money(p.amount)}</span>
                    </TD>
                    <TD className="text-right">
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Payment actions">
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem onSelect={() => window.open(invoiceUrl(p.id), '_blank', 'noopener')}>
                            <FileText /> Open invoice
                          </MenuItem>
                          <MenuItem onSelect={() => download(`/payments/${p.id}/invoice.pdf`, { download: true }, `${p.invoice_number}.pdf`)}>
                            <Download /> Download invoice
                          </MenuItem>
                          {messaging?.email && (
                            <MenuItem onSelect={() => email.mutate(p.id)}>
                              <Mail /> Email invoice
                            </MenuItem>
                          )}
                          <MenuSeparator />
                          <MenuItem danger disabled={!!p.refunded_at} onSelect={() => confirm(`Refund ${money(p.amount)} to ${p.member_name}?`) && refund.mutate(p.id)}>
                            <Undo2 /> Refund
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} size={SIZE} total={data.total} onPage={(n) => patch({ page: n })} />
          </>
        )}
      </Card>

      <PaymentDialog open={!!params.new} memberId={params.member ? Number(params.member) : null} onOpenChange={(o) => !o && patch({ new: null, member: null })} />
    </>
  )
}
