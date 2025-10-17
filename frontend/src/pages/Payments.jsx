import { useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Table from '../components/ui/Table'
import Select from '../components/ui/Select'
import Input from '../components/ui/Input'
import { usePayments } from '../hooks/usePayments'
import { useBusiness } from '../context/BusinessContext'

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'OVERDUE', label: 'Overdue' },
]

const periodOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

export default function Payments() {
  const [status, setStatus] = useState('ALL')
  const [period, setPeriod] = useState('30')
  const [query, setQuery] = useState('')

  const { business } = useBusiness()
  const { data, loading, error, refresh } = usePayments({
    status: status === 'ALL' ? undefined : status,
    days: Number(period),
  })

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
        title="Unable to load payments"
        description={error.detail ?? 'Please try again later.'}
        actions={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: business?.currency ?? 'USD',
  })

  const filteredPayments = data?.payments?.filter((payment) => {
    if (!query) return true
    const normalizedQuery = query.toLowerCase()
    return [payment.member_name, payment.membership_plan, payment.receipt_number]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  })

  const columns = [
    {
      key: 'member',
      header: 'Member',
      render: (payment) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">{payment.member_name}</p>
          <p className="text-xs text-slate-500">{payment.membership_plan ?? 'General membership'}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (payment) => formatDate(payment.payment_date),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (payment) => formatter.format(Number(payment.amount)),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => <Badge variant={badgeVariantForStatus(payment.status)}>{payment.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: () => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm">
            View Receipt
          </Button>
          <Button size="sm">Send Reminder</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor transactions, follow up on outstanding invoices, and stay on top of cash flow.</p>
        </div>
        <Button>Record Payment</Button>
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payments" />
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card title="Summary" subtitle={`Based on the last ${period} days`}>
          <dl className="grid gap-3">
            <SummaryItem label="Total Payments" value={data?.summary?.total ?? 0} />
            <SummaryItem label="Total Revenue" value={formatter.format(Number(data?.summary?.revenue ?? 0))} />
            <SummaryItem label="Average Ticket" value={formatter.format(Number(data?.summary?.average_ticket ?? 0))} />
            <SummaryItem label="Outstanding" value={formatter.format(Number(data?.summary?.outstanding ?? 0))} />
          </dl>
        </Card>
        <Card title="Collections" subtitle="Breakdown by status" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryItem label="Paid" value={formatter.format(Number(data?.summary?.by_status?.PAID ?? 0))} />
            <SummaryItem label="Pending" value={formatter.format(Number(data?.summary?.by_status?.PENDING ?? 0))} />
            <SummaryItem label="Failed" value={formatter.format(Number(data?.summary?.by_status?.FAILED ?? 0))} />
            <SummaryItem label="Overdue" value={formatter.format(Number(data?.summary?.by_status?.OVERDUE ?? 0))} />
          </div>
        </Card>
      </section>

      <Card>
        <Table
          columns={columns}
          data={filteredPayments ?? []}
          emptyState={{
            title: 'No payments found',
            description: 'Try adjusting filters or record a new payment.',
          }}
        />
      </Card>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function badgeVariantForStatus(status) {
  switch (status) {
    case 'PAID':
      return 'success'
    case 'PENDING':
      return 'info'
    case 'FAILED':
      return 'danger'
    case 'OVERDUE':
      return 'warning'
    default:
      return 'secondary'
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
