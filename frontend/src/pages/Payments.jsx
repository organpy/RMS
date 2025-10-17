import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import Select from '../components/ui/Select'
import Input from '../components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/skeleton'
import { usePayments, createPayment, updatePayment } from '../hooks/usePayments'
import { useBusiness } from '../context/BusinessContext'
import { useToast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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

const paymentStatusOptions = statusOptions.filter((option) => option.value !== 'ALL')

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  },
  z.string().optional(),
)

const optionalDateInput = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  },
  z
    .string()
    .refine((val) => !Number.isNaN(new Date(val).getTime()), 'Choose a valid date')
    .optional(),
)

const amountSchema = z
  .string()
  .trim()
  .min(1, 'Amount is required')
  .refine((value) => !Number.isNaN(Number(value)), 'Enter a valid number')
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), 'Enter a valid number')
  .refine((value) => value >= 0, 'Amount must be zero or greater')

const paymentFormSchema = z.object({
  member_name: z.string().trim().min(1, 'Member name is required'),
  membership_plan: optionalText,
  amount: amountSchema,
  status: z.enum(['PAID', 'PENDING', 'FAILED', 'OVERDUE']),
  payment_date: optionalDateInput,
})

const paymentFormDefaults = {
  member_name: '',
  membership_plan: '',
  amount: '',
  status: 'PAID',
  payment_date: '',
}

export default function Payments() {
  const [status, setStatus] = useState('ALL')
  const [period, setPeriod] = useState('30')
  const [query, setQuery] = useState('')
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [pendingPaymentId, setPendingPaymentId] = useState(null)

  const { business } = useBusiness()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: paymentFormDefaults,
  })

  const {
    data,
    loading,
    error,
    refresh,
    isFetching,
    queryKey,
  } = usePayments({
    status: status === 'ALL' ? undefined : status,
    days: Number(period),
  })

  const createPaymentMutation = useMutation({
    mutationFn: createPayment,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      const optimisticPayment = {
        id: `optimistic-${Date.now()}`,
        member_name: payload.member_name ?? 'Pending member',
        membership_plan: payload.membership_plan ?? 'General membership',
        payment_date: payload.payment_date ?? new Date().toISOString(),
        amount: payload.amount ?? 0,
        status: payload.status ?? 'PENDING',
        receipt_number: payload.receipt_number ?? `TEMP-${Date.now()}`,
      }

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) {
          return { payments: [optimisticPayment] }
        }
        const payments = old.payments ?? []
        return { ...old, payments: [optimisticPayment, ...payments] }
      })

      return { previous, optimisticPayment }
    },
    onSuccess: (result, _payload, context) => {
      const resolvedPayment = result ?? context?.optimisticPayment
      if (context?.optimisticPayment && resolvedPayment) {
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old
          return {
            ...old,
            payments: (old.payments ?? []).map((payment) =>
              payment.id === context.optimisticPayment.id ? resolvedPayment : payment,
            ),
          }
        })
      }

      toast({
        title: 'Payment recorded',
        description: `${resolvedPayment?.member_name ?? 'New payment'} was added successfully.`,
      })
      setCreateOpen(false)
    },
    onError: (mutationError, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast({
        variant: 'destructive',
        title: 'Unable to record payment',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, status: nextStatus }) => updatePayment(id, { status: nextStatus }),
    onMutate: async ({ id, status: nextStatus }) => {
      setPendingPaymentId(id)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          payments: (old.payments ?? []).map((payment) =>
            payment.id === id ? { ...payment, status: nextStatus } : payment,
          ),
        }
      })

      return { previous }
    },
    onSuccess: (_result, { status: nextStatus }) => {
      toast({
        title: 'Payment updated',
        description: `Status marked as ${nextStatus.toLowerCase()}.`,
      })
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast({
        variant: 'destructive',
        title: 'Unable to update payment',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      setPendingPaymentId(null)
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const isRefreshing = isFetching && Boolean(data)

  useEffect(() => {
    if (!isCreateOpen) {
      reset({ ...paymentFormDefaults })
    }
  }, [isCreateOpen, reset])

  if (loading && !data) {
    return <PaymentsSkeleton />
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load payments</AlertTitle>
            <AlertDescription>{error.detail ?? 'Please try again later.'}</AlertDescription>
          </Alert>
          <Button onClick={refresh}>Retry</Button>
        </div>
      </div>
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
      render: (payment) => (
        <PaymentRowActions
          payment={payment}
          onSendReminder={handleSendReminder}
          onMarkPaid={handleMarkAsPaid}
          isUpdating={pendingPaymentId === payment.id && updatePaymentMutation.isPending}
        />
      ),
    },
  ]

  const handleCreateSubmit = handleSubmit((values) => {
    const payload = {
      member_name: values.member_name,
      membership_plan: values.membership_plan ?? undefined,
      amount: values.amount,
      status: values.status,
      payment_date: values.payment_date ? new Date(values.payment_date).toISOString() : new Date().toISOString(),
    }

    createPaymentMutation.mutate(payload, {
      onSuccess: () => {
        reset({ ...paymentFormDefaults })
      },
    })
  })

  const handleMarkAsPaid = (payment) => {
    updatePaymentMutation.mutate({ id: payment.id, status: 'PAID' })
  }

  const handleSendReminder = (payment) => {
    toast({
      title: 'Reminder queued',
      description: `We&apos;ll notify ${payment.member_name} about the outstanding invoice.`,
    })
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor transactions, follow up on outstanding invoices, and stay on top of cash flow.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record a payment</DialogTitle>
              <DialogDescription>Track an offline payment and keep your revenue metrics fresh.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreateSubmit} noValidate>
              <div className="space-y-1 text-sm">
                <label className="font-medium text-slate-700" htmlFor="payment-member-name">
                  Member name
                </label>
                <Input
                  id="payment-member-name"
                  placeholder="Jordan Mitchell"
                  disabled={createPaymentMutation.isPending}
                  aria-invalid={Boolean(errors.member_name)}
                  {...register('member_name')}
                />
                {errors.member_name ? (
                  <p className="text-xs text-destructive">{errors.member_name.message}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="payment-amount">
                    Amount
                  </label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="49.99"
                    disabled={createPaymentMutation.isPending}
                    aria-invalid={Boolean(errors.amount)}
                    {...register('amount')}
                  />
                  {errors.amount ? (
                    <p className="text-xs text-destructive">{errors.amount.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="payment-status">
                    Status
                  </label>
                  <Select
                    id="payment-status"
                    disabled={createPaymentMutation.isPending}
                    aria-invalid={Boolean(errors.status)}
                    {...register('status')}
                  >
                    {paymentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {errors.status ? (
                    <p className="text-xs text-destructive">{errors.status.message}</p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="payment-plan">
                    Membership plan
                  </label>
                  <Input
                    id="payment-plan"
                    placeholder="Premium"
                    disabled={createPaymentMutation.isPending}
                    {...register('membership_plan')}
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="payment-date">
                    Payment date
                  </label>
                  <Input
                    id="payment-date"
                    type="date"
                    disabled={createPaymentMutation.isPending}
                    aria-invalid={Boolean(errors.payment_date)}
                    {...register('payment_date')}
                  />
                  {errors.payment_date ? (
                    <p className="text-xs text-destructive">{errors.payment_date.message}</p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreateOpen(false)
                    reset({ ...paymentFormDefaults })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createPaymentMutation.isPending}>
                  {createPaymentMutation.isPending ? 'Saving…' : 'Save payment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      {isRefreshing ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Spinner size="sm" className="text-primary" />
          Syncing the latest payment data…
        </div>
      ) : null}

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
  switch ((status ?? '').toUpperCase()) {
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

function PaymentRowActions({ payment, onSendReminder, onMarkPaid, isUpdating }) {
  const isPaid = (payment.status ?? '').toUpperCase() === 'PAID'

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={() => onSendReminder(payment)}>
        Send reminder
      </Button>
      <Button
        size="sm"
        variant={isPaid ? 'secondary' : 'primary'}
        onClick={() => onMarkPaid(payment)}
        disabled={isPaid || isUpdating}
      >
        {isPaid ? 'Paid' : isUpdating ? 'Marking…' : 'Mark as paid'}
      </Button>
    </div>
  )
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </Card>
        <Card className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid gap-4 border-b pb-4 last:border-none last:pb-0 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full md:w-44" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
