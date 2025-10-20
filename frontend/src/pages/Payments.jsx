import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
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
import {
  usePayments,
  createPayment,
  updatePayment,
  regenerateReceipt,
  downloadReceipt,
  queuePaymentReminder,
  fetchPaymentReminder,
} from '../hooks/usePayments'
import { get } from '../services/api'
import { useBusiness } from '../context/BusinessContext'
import { useToast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DataTable from '../components/data/DataTable'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCommand } from '@/hooks/useCommand'
import { exportPaymentsCsv } from '@/utils/exporters/payments'

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

const MEMBER_FETCH_LIMIT = 100

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
  .refine((value) => value > 0, 'Amount must be greater than zero')

const memberIdSchema = z
  .string()
  .trim()
  .min(1, 'Select a member')
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, 'Select a member')

const paymentFormSchema = z.object({
  member_id: memberIdSchema,
  member_name: z.string().trim().min(1, 'Member name is required'),
  membership_plan: optionalText,
  amount: amountSchema,
  status: z.enum(['PAID', 'PENDING', 'FAILED', 'OVERDUE']),
  payment_date: optionalDateInput,
})

const paymentFormDefaults = {
  member_id: '',
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
  const [prefillMember, setPrefillMember] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [createdPayment, setCreatedPayment] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [pendingReminderId, setPendingReminderId] = useState(null)
  const [reminderDrawerPaymentId, setReminderDrawerPaymentId] = useState(null)
  const [isReminderDrawerOpen, setReminderDrawerOpen] = useState(false)

  const { business } = useBusiness()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleCommandOpenCreate = useCallback((detail = {}) => {
    setPrefillMember({
      memberName: detail.member_name ?? detail.memberName ?? '',
      membershipPlan: detail.membership_plan ?? detail.membershipPlan ?? '',
      memberId: detail.member_id ?? detail.memberId ?? null,
    })
    setCreateOpen(true)
  }, [])

  const handleCommandFilterStatus = useCallback(
    ({ status: nextStatus, message, period: nextPeriod }) => {
      if (!nextStatus && !nextPeriod) return

      if (nextStatus) {
        const matchingOption = statusOptions.find(
          (option) => option.value.toUpperCase() === nextStatus.toUpperCase(),
        )
        const valueToSet = matchingOption?.value ?? nextStatus
        setStatus(valueToSet)

        const statusLabel = matchingOption?.label ?? valueToSet.toString()
        const description =
          message ??
          `Showing ${statusLabel.toLowerCase()} payments${nextPeriod ? ` from the last ${nextPeriod} days` : ''}.`

        toast({
          title: 'Filter applied',
          description,
        })
      }

      if (nextPeriod) {
        setPeriod(String(nextPeriod))
      }

      setQuery('')
    },
    [toast],
  )

  useCommand('payments.openCreate', handleCommandOpenCreate)
  useCommand('payments.filterStatus', handleCommandFilterStatus)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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

  const memberIdValue = watch('member_id')

  const {
    data: memberResults = [],
    isLoading: membersLoading,
    error: membersError,
  } = useQuery({
    queryKey: ['payment-member-options'],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', String(MEMBER_FETCH_LIMIT))
      params.set('status', 'ACTIVE')
      const raw = await get(`/api/members?${params.toString()}`)
      if (Array.isArray(raw?.data)) {
        return raw.data
      }
      if (Array.isArray(raw?.members)) {
        return raw.members
      }
      return []
    },
    enabled: isCreateOpen,
    staleTime: 5 * 60 * 1000,
  })

  const memberOptions = useMemo(() => {
    const mapped = (Array.isArray(memberResults) ? memberResults : []).map((member) => {
      const displayName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
      const label = displayName || member.email || `Member #${member.id}`
      return {
        value: String(member.id),
        label,
        plan: member.membership_plan ?? '',
      }
    })

    if (prefillMember?.memberId && prefillMember?.memberName) {
      const prefillId = String(prefillMember.memberId)
      const exists = mapped.some((option) => option.value === prefillId)
      if (!exists) {
        mapped.push({
          value: prefillId,
          label: prefillMember.memberName,
          plan: prefillMember.membershipPlan ?? '',
        })
      }
    }

    return mapped.sort((a, b) => a.label.localeCompare(b.label))
  }, [memberResults, prefillMember])

  const selectedMember = useMemo(
    () => memberOptions.find((option) => option.value === (memberIdValue ?? '')),
    [memberIdValue, memberOptions],
  )

  useEffect(() => {
    if (!selectedMember) return

    setValue('member_name', selectedMember.label, { shouldValidate: false })
    if (selectedMember.plan) {
      setValue('membership_plan', selectedMember.plan, { shouldDirty: false, shouldValidate: false })
    }
  }, [selectedMember, setValue])

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
    onSuccess: async (result, _payload, context) => {
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
      try {
        setCreatedPayment(resolvedPayment)
        setPreviewLoading(true)
        const blob = await downloadReceipt(resolvedPayment.id)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
      } catch (err) {
        toast({ variant: 'destructive', title: 'Preview unavailable', description: err?.detail ?? 'Unable to load receipt preview.' })
      } finally {
        setPreviewLoading(false)
      }
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

  const queueReminderMutation = useMutation({
    mutationFn: ({ paymentId, note }) =>
      queuePaymentReminder(paymentId, {
        scheduled_for: new Date().toISOString(),
        note: note ?? null,
      }),
    onMutate: async ({ paymentId }) => {
      setPendingReminderId(paymentId)
      await queryClient.cancelQueries({ queryKey })
      return { paymentId }
    },
    onSuccess: (envelope, { paymentId, memberName }) => {
      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        const existing = old.payments ?? old.data ?? []
        const updatedPayments = existing.map((payment) => {
          if (payment.id !== paymentId) return payment
          return {
            ...payment,
            reminder_status: envelope.summary.status,
            reminder_attempt_count: envelope.summary.attempt_count,
            reminder_last_attempt_at: envelope.summary.last_attempt_at,
            reminder_next_scheduled_at: envelope.summary.next_scheduled_at,
          }
        })
        return {
          ...old,
          payments: updatedPayments,
          data: updatedPayments,
        }
      })

      queryClient.setQueryData(['payment-reminder', paymentId], envelope)

      toast({
        title: 'Reminder queued',
        description:
          envelope.summary.next_scheduled_at
            ? `We’ll nudge ${memberName ?? 'this member'} on ${new Date(
                envelope.summary.next_scheduled_at,
              ).toLocaleString()}.`
            : `We’ll nudge ${memberName ?? 'this member'} shortly.`,
      })

      setReminderDrawerPaymentId(paymentId)
      setReminderDrawerOpen(true)
    },
    onError: (mutationError) => {
      toast({
        variant: 'destructive',
        title: 'Unable to queue reminder',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      setPendingReminderId(null)
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const reminderQueryKey = useMemo(
    () => ['payment-reminder', reminderDrawerPaymentId ?? 'inactive'],
    [reminderDrawerPaymentId],
  )

  const {
    data: reminderEnvelope,
    isLoading: reminderLoading,
    isFetching: reminderFetching,
    error: reminderError,
    refetch: refetchReminder,
  } = useQuery({
    queryKey: reminderQueryKey,
    queryFn: async () => fetchPaymentReminder(reminderDrawerPaymentId),
    enabled: isReminderDrawerOpen && Boolean(reminderDrawerPaymentId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    initialData: () => {
      if (!reminderDrawerPaymentId) return undefined
      return queryClient.getQueryData(['payment-reminder', reminderDrawerPaymentId])
    },
  })

  const reminderPayment = useMemo(() => {
    if (!reminderDrawerPaymentId) return null
    const collection = data?.payments ?? data?.data ?? []
    return collection.find((payment) => payment.id === reminderDrawerPaymentId) ?? null
  }, [data, reminderDrawerPaymentId])

  const isReminderLoading = reminderLoading || reminderFetching

  const isRefreshing = isFetching && Boolean(data)

  useEffect(() => {
    if (!isCreateOpen) {
      reset({ ...paymentFormDefaults })
      setPrefillMember(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      setPreviewLoading(false)
      setCreatedPayment(null)
      return
    }

    reset({
      ...paymentFormDefaults,
      member_id: prefillMember?.memberId ? String(prefillMember.memberId) : paymentFormDefaults.member_id,
      member_name: prefillMember?.memberName ?? paymentFormDefaults.member_name,
      membership_plan: prefillMember?.membershipPlan ?? paymentFormDefaults.membership_plan,
    })
  }, [isCreateOpen, prefillMember, previewUrl, reset])

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: business?.currency ?? 'USD',
      }),
    [business?.currency],
  )

  const filteredPayments = data?.payments?.filter((payment) => {
    if (!query) return true
    const normalizedQuery = query.toLowerCase()
    return [payment.member_name, payment.membership_plan, payment.receipt_number]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  })

  const handleExportAll = useCallback(async () => {
    try {
      setIsExporting(true)
      const result = await exportPaymentsCsv(
        {
          status: status === 'ALL' ? undefined : status,
          days: Number(period),
        },
        { currency: business?.currency ?? 'USD' },
      )
      toast({
        title: 'Export ready',
        description:
          result.count > 0
            ? `Downloaded ${result.count} payment${result.count === 1 ? '' : 's'} to CSV.`
            : 'Export created with headers only. No payments matched these filters.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error?.detail ?? 'Unable to generate the payments export right now.',
      })
    } finally {
      setIsExporting(false)
    }
  }, [business?.currency, period, status, toast])

  const handleCreateSubmit = handleSubmit((values) => {
    const payload = {
      member_id: values.member_id,
      member_name: values.member_name,
      membership_plan: values.membership_plan ?? undefined,
      amount: values.amount,
      status: values.status,
      payment_date: values.payment_date || new Date().toISOString().slice(0, 10),
    }

    createPaymentMutation.mutate(payload)
  })

  const handleMarkAsPaid = useCallback(
    (payment) => {
      updatePaymentMutation.mutate({ id: payment.id, status: 'PAID' })
    },
    [updatePaymentMutation],
  )

  const handleSendReminder = useCallback(
    (payment) => {
      if (!payment?.id) return
      queueReminderMutation.mutate({ paymentId: payment.id, memberName: payment.member_name })
    },
    [queueReminderMutation],
  )

  const handleViewReminder = useCallback(
    (payment) => {
      if (!payment?.id) return
      const queryKey = ['payment-reminder', payment.id]
      void queryClient.prefetchQuery({ queryKey, queryFn: () => fetchPaymentReminder(payment.id) })
      setReminderDrawerPaymentId(payment.id)
      setReminderDrawerOpen(true)
    },
    [queryClient],
  )

  const handleReminderDrawerChange = useCallback((open) => {
    setReminderDrawerOpen(open)
    if (!open) {
      setReminderDrawerPaymentId(null)
    }
  }, [])

  const columns = useMemo(
    () => [
      {
        id: 'member',
        accessorFn: (payment) => payment.member_name ?? '',
        header: 'Member',
        cell: ({ row }) => {
          const payment = row.original
          return (
            <div>
              <p className="text-sm font-semibold text-slate-900">{payment.member_name}</p>
              <p className="text-xs text-slate-500">{payment.membership_plan ?? 'General membership'}</p>
            </div>
          )
        },
        meta: {
          exportValue: (payment) => payment.member_name ?? '',
        },
        size: 240,
      },
      {
        accessorKey: 'membership_plan',
        header: 'Plan',
        cell: ({ row }) => {
          const payment = row.original
          return (
            <div>
              <p className="text-sm text-slate-900">{payment.membership_plan ?? 'General membership'}</p>
              <p className="text-xs text-slate-500">
                {payment.receipt_number ? (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Receipt {payment.receipt_number}
                  </span>
                ) : (
                  'No receipt on file'
                )}
              </p>
            </div>
          )
        },
        meta: {
          exportValue: (payment) => payment.membership_plan ?? '',
        },
        size: 220,
      },
      {
        accessorKey: 'payment_date',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.payment_date),
        meta: {
          exportValue: (payment) => formatDate(payment.payment_date),
        },
        size: 140,
      },
      {
        id: 'amount',
        accessorFn: (payment) => Number(payment.amount ?? 0),
        header: 'Amount',
        cell: ({ row }) => {
          const value = Number(row.getValue('amount') ?? 0)
          return <span className="font-medium text-slate-900">{formatter.format(value)}</span>
        },
        meta: {
          headerClassName: 'text-right',
          cellClassName: 'text-right',
          exportValue: (payment) => formatter.format(Number(payment.amount ?? 0)),
        },
        size: 140,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const payment = row.original
          return <Badge variant={badgeVariantForStatus(payment.status)}>{payment.status}</Badge>
        },
        meta: {
          exportValue: (payment) => payment.status ?? '',
        },
        size: 130,
      },
      {
        accessorKey: 'receipt_number',
        header: 'Receipt',
        cell: ({ row }) => row.original.receipt_number ?? '—',
        meta: {
          exportValue: (payment) => payment.receipt_number ?? '',
        },
        size: 160,
      },
      {
        id: 'reminders',
        header: 'Reminders',
        cell: ({ row }) => (
          <ReminderStatusCell
            payment={row.original}
            onViewReminder={handleViewReminder}
            isQueuing={queueReminderMutation.isPending && pendingReminderId === row.original.id}
          />
        ),
        enableSorting: false,
        meta: {
          exportValue: (payment) => `${payment.reminder_status ?? 'idle'} | ${payment.reminder_attempt_count ?? 0}`,
        },
        size: 220,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <PaymentRowActions
            payment={row.original}
            onSendReminder={handleSendReminder}
            onMarkPaid={handleMarkAsPaid}
            onViewReminder={handleViewReminder}
            isUpdating={pendingPaymentId === row.original.id && updatePaymentMutation.isPending}
            isQueuingReminder={queueReminderMutation.isPending && pendingReminderId === row.original.id}
            formatter={formatter}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: 'text-right',
          cellClassName: 'text-right',
          exportValue: () => '',
        },
        size: 200,
      },
    ],
    [
      formatter,
      handleMarkAsPaid,
      handleSendReminder,
      handleViewReminder,
      pendingPaymentId,
      pendingReminderId,
      queueReminderMutation.isPending,
      updatePaymentMutation.isPending,
    ],
  )

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
            {previewUrl || previewLoading ? (
              <div className="space-y-4">
                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium text-slate-700">Receipt preview</p>
                  <p className="text-xs text-slate-500">{createdPayment?.receipt_number ?? 'Generating receipt…'}</p>
                  <div className="mt-3 h-[60vh] w-full overflow-hidden rounded-lg border bg-white">
                    {previewLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <Spinner />
                      </div>
                    ) : (
                      <iframe title="Receipt Preview" src={previewUrl} className="h-full w-full" />
                    )}
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
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      try {
                        const blob = await downloadReceipt(createdPayment.id)
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.setAttribute('download', `${createdPayment?.receipt_number ?? 'receipt'}-${createdPayment?.id}.pdf`)
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        URL.revokeObjectURL(url)
                      } catch (err) {
                        toast({ variant: 'destructive', title: 'Download failed', description: err?.detail ?? 'Unable to download receipt.' })
                      }
                    }}
                    disabled={previewLoading || !createdPayment}
                  >
                    Download PDF
                  </Button>
                </DialogFooter>
              </div>
            ) : (
            <form className="space-y-4" onSubmit={handleCreateSubmit} noValidate>
              <input type="hidden" {...register('member_name')} />
              <div className="space-y-1 text-sm">
                <label className="font-medium text-slate-700" htmlFor="payment-member">
                  Member
                </label>
                <Select
                  id="payment-member"
                  disabled={createPaymentMutation.isPending}
                  aria-invalid={Boolean(errors.member_id)}
                  {...register('member_id')}
                >
                  <option value="">Select a member</option>
                  {memberOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {membersLoading ? (
                  <p className="text-xs text-slate-500">Loading members…</p>
                ) : null}
                {membersError ? (
                  <p className="text-xs text-destructive">
                    {membersError?.detail ?? membersError?.message ?? 'Unable to load members.'}
                  </p>
                ) : null}
                {!membersLoading && !membersError && memberOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">Add a member first to record payments.</p>
                ) : null}
                {errors.member_id ? (
                  <p className="text-xs text-destructive">{errors.member_id.message}</p>
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
                    min="0.01"
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
            )}
          </DialogContent>
        </Dialog>
      </section>

      {isRefreshing ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Spinner size="sm" className="text-primary" />
          Syncing the latest payment data…
        </div>
      ) : null}

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

      <DataTable
        columns={columns}
        data={filteredPayments ?? []}
        exportFileName="payments-export.csv"
        emptyState={{
          title: 'No payments found',
          description: 'Try adjusting filters or record a new payment.',
        }}
        toolbarContent={(
          <>
            <Select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-full sm:w-48"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full sm:w-48"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search payments"
              className="w-full sm:w-64"
            />
            <Button variant="secondary" onClick={refresh} disabled={isFetching}>
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExportAll} disabled={isExporting || !data?.payments?.length}>
              {isExporting ? 'Exporting…' : 'Export all CSV'}
            </Button>
          </>
        )}
      />
      <ReminderDrawer
        open={isReminderDrawerOpen}
        onOpenChange={handleReminderDrawerChange}
        payment={reminderPayment}
        envelope={reminderEnvelope}
        isLoading={isReminderLoading}
        error={reminderError}
        onRefresh={reminderDrawerPaymentId ? refetchReminder : undefined}
      />
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

function formatDateTime(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toLocaleString()
}

function PaymentRowActions({
  payment,
  onSendReminder,
  onMarkPaid,
  onViewReminder,
  isUpdating,
  isQueuingReminder,
  formatter,
}) {
  const isPaid = (payment.status ?? '').toUpperCase() === 'PAID'

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
      <PaymentDetailsSheet
        payment={payment}
        onSendReminder={onSendReminder}
        onMarkPaid={onMarkPaid}
        onViewReminder={onViewReminder}
        isUpdating={isUpdating}
        isQueuingReminder={isQueuingReminder}
        formatter={formatter}
      />
      <div className="hidden items-center gap-2 sm:flex">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSendReminder(payment)}
          disabled={isQueuingReminder}
        >
          {isQueuingReminder ? 'Sending…' : 'Send reminder'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onViewReminder(payment)}>
          View history
        </Button>
        <ReceiptActions payment={payment} />
        <Button
          size="sm"
          variant={isPaid ? 'secondary' : 'primary'}
          onClick={() => onMarkPaid(payment)}
          disabled={isPaid || isUpdating}
        >
          {isPaid ? 'Paid' : isUpdating ? 'Marking…' : 'Mark as paid'}
        </Button>
      </div>
    </div>
  )
}

function PaymentDetailsSheet({
  payment,
  onSendReminder,
  onMarkPaid,
  onViewReminder,
  isUpdating,
  isQueuingReminder,
  formatter,
}) {
  const [open, setOpen] = useState(false)
  const isPaid = (payment.status ?? '').toUpperCase() === 'PAID'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:hidden">
          View
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto sm:hidden">
        <SheetHeader>
          <SheetTitle>{payment.member_name}</SheetTitle>
          {payment.membership_plan ? (
            <SheetDescription>{payment.membership_plan}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="mt-6 space-y-4 text-sm text-slate-600">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
            <p className="mt-1 font-medium text-foreground">
              {formatter.format(Number(payment.amount ?? 0))}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 font-medium text-foreground">{payment.status ?? 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
            <p className="mt-1 font-medium text-foreground">{formatDate(payment.payment_date)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
            <p className="mt-1 font-medium text-foreground">{payment.receipt_number ?? '—'}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onSendReminder(payment)
              setOpen(false)
            }}
            disabled={isQueuingReminder}
          >
            {isQueuingReminder ? 'Sending…' : 'Send reminder'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onViewReminder(payment)
              setOpen(false)
            }}
          >
            View reminder history
          </Button>
          <ReceiptActions payment={payment} fullWidth />
          <Button
            onClick={() => {
              onMarkPaid(payment)
              setOpen(false)
            }}
            disabled={isPaid || isUpdating}
          >
            {isPaid ? 'Already paid' : isUpdating ? 'Marking…' : 'Mark as paid'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReminderStatusCell({ payment, onViewReminder, isQueuing }) {
  const status = formatReminderStatusLabel(payment.reminder_status)
  const variant = reminderBadgeVariant(payment.reminder_status)
  const attemptCount = payment.reminder_attempt_count ?? 0
  const lastAttempt = formatDateTime(payment.reminder_last_attempt_at)
  const nextScheduled = formatDateTime(payment.reminder_next_scheduled_at)

  const attemptSummary = isQueuing
    ? 'Sending reminder…'
    : attemptCount > 0
      ? `${attemptCount} attempt${attemptCount === 1 ? '' : 's'}${lastAttempt ? ` • Last ${lastAttempt}` : ''}`
      : 'No reminders logged yet'

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={variant}>{status}</Badge>
      <p className="text-xs text-muted-foreground">{attemptSummary}</p>
      {nextScheduled ? (
        <p className="text-xs text-muted-foreground">Next: {nextScheduled}</p>
      ) : null}
      <Button variant="ghost" size="sm" className="px-0 text-xs" onClick={() => onViewReminder(payment)}>
        View history
      </Button>
    </div>
  )
}

function ReminderDrawer({ open, onOpenChange, payment, envelope, isLoading, error, onRefresh }) {
  const hasHistory = Boolean(envelope?.history?.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reminder history</DialogTitle>
          <DialogDescription>
            {payment
              ? `Follow-ups for ${payment.member_name ?? 'this member'} (${payment.receipt_number ?? 'no receipt'})`
              : 'Select a payment to view its reminder activity.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : null}

        {!isLoading && error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load reminders</AlertTitle>
            <AlertDescription>
              {error?.detail ?? error?.message ?? 'Please try again in a moment.'}
            </AlertDescription>
            {onRefresh ? (
              <Button size="sm" variant="outline" className="mt-3" onClick={onRefresh}>
                Retry
              </Button>
            ) : null}
          </Alert>
        ) : null}

        {!isLoading && !error && envelope ? (
          <div className="space-y-6">
            <ReminderSummaryCard summary={envelope.summary} />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
              {hasHistory ? (
                <div className="mt-3 space-y-3">
                  {envelope.history.map((entry) => (
                    <ReminderHistoryItem key={entry.attempted_at} entry={entry} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No reminder attempts recorded yet.</p>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onRefresh ? (
            <Button type="button" onClick={onRefresh} disabled={isLoading || !payment}>
              Refresh
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReminderSummaryCard({ summary }) {
  if (!summary) return null
  const statusLabel = formatReminderStatusLabel(summary.status)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={reminderBadgeVariant(summary.status)}>{statusLabel}</Badge>
        <span className="text-xs text-muted-foreground">
          {summary.attempt_count} attempt{summary.attempt_count === 1 ? '' : 's'} total
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium text-slate-700">Last attempt</dt>
          <dd>{formatDateTime(summary.last_attempt_at) ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium text-slate-700">Next scheduled</dt>
          <dd>{formatDateTime(summary.next_scheduled_at) ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

function ReminderHistoryItem({ entry }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-900">
          {formatDateTime(entry.attempted_at) ?? 'Unknown timestamp'}
        </span>
        <Badge variant={reminderResultVariant(entry.result)}>
          {formatReminderStatusLabel(entry.result)}
        </Badge>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        {entry.scheduled_for ? (
          <div className="flex items-center justify-between gap-3">
            <dt>Scheduled for</dt>
            <dd>{formatDateTime(entry.scheduled_for) ?? '—'}</dd>
          </div>
        ) : null}
        {entry.note ? (
          <div>
            <dt className="font-medium text-slate-600">Note</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">{entry.note}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function reminderBadgeVariant(status) {
  switch ((status ?? '').toString().toUpperCase()) {
    case 'QUEUED':
      return 'info'
    case 'SENT':
      return 'success'
    case 'COMPLETED':
      return 'success'
    case 'SKIPPED':
      return 'warning'
    default:
      return 'secondary'
  }
}

function reminderResultVariant(result) {
  switch ((result ?? '').toString().toUpperCase()) {
    case 'COMPLETED':
      return 'success'
    case 'SKIPPED':
      return 'warning'
    default:
      return 'info'
  }
}

function formatReminderStatusLabel(value) {
  if (!value) return 'Idle'
  const normalized = value.toString().toLowerCase()
  switch (normalized) {
    case 'queued':
      return 'Queued'
    case 'sent':
      return 'Sent'
    case 'completed':
      return 'Completed'
    case 'skipped':
      return 'Skipped'
    case 'idle':
    default:
      return 'Idle'
  }
}

function ReceiptActions({ payment, fullWidth = false }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const handleDownload = async () => {
    try {
      setBusy(true)
      const blob = await downloadReceipt(payment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const filename = `${payment.receipt_number ?? 'receipt'}-${payment.id}.pdf`
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Download failed', description: err?.detail ?? 'Unable to download receipt.' })
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async () => {
    try {
      setBusy(true)
      await regenerateReceipt(payment.id)
      toast({ title: 'Receipt refreshed', description: 'A new receipt was generated for this payment.' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not regenerate', description: err?.detail ?? 'Please try again later.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={fullWidth ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
      <Button variant="ghost" size="sm" className={fullWidth ? 'w-full' : ''} onClick={handleDownload} disabled={busy}>
        {busy ? 'Downloading…' : 'Download receipt'}
      </Button>
      <Button variant="outline" size="sm" className={fullWidth ? 'w-full' : ''} onClick={handleRegenerate} disabled={busy}>
        {busy ? 'Working…' : 'Regenerate'}
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
