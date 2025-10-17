import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useMembers, createMember, updateMemberStatus } from '../hooks/useMembers'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import { Skeleton } from '../components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import DataTable from '../components/data/DataTable'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

const memberStatusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  },
  z.string().optional(),
)

const memberFormSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  membership_plan: optionalText,
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
})

const memberFormDefaults = {
  first_name: '',
  last_name: '',
  email: '',
  membership_plan: '',
  status: 'ACTIVE',
}

export default function Members() {
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(memberFormSchema),
    defaultValues: memberFormDefaults,
  })

  const {
    data,
    loading,
    error,
    refresh,
    isFetching,
    queryKey,
  } = useMembers({ status: status === 'ALL' ? undefined : status })

  const createMemberMutation = useMutation({
    mutationFn: createMember,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      const optimisticMember = {
        id: `optimistic-${Date.now()}`,
        first_name: payload.first_name ?? 'New',
        last_name: payload.last_name ?? 'Member',
        email: payload.email ?? 'pending@example.com',
        membership_plan: payload.membership_plan ?? 'General membership',
        status: payload.status ?? 'ACTIVE',
        join_date: new Date().toISOString(),
        next_payment_due: payload.next_payment_due ?? null,
      }

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) {
          return { members: [optimisticMember] }
        }
        const members = old.members ?? []
        return { ...old, members: [optimisticMember, ...members] }
      })

      return { previous, optimisticMember }
    },
    onSuccess: (result, _payload, context) => {
      const nextMember = result ?? context?.optimisticMember
      if (context?.optimisticMember && nextMember) {
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old
          return {
            ...old,
            members: (old.members ?? []).map((member) =>
              member.id === context.optimisticMember.id ? nextMember : member,
            ),
          }
        })
      }

      toast({
        title: 'Member added',
        description: `${nextMember?.first_name ?? 'New'} ${nextMember?.last_name ?? 'member'} was created.`,
      })
      setCreateOpen(false)
    },
    onError: (mutationError, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast({
        variant: 'destructive',
        title: 'Unable to add member',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status: nextStatus }) => updateMemberStatus(id, { status: nextStatus }),
    onMutate: async ({ id, status: nextStatus }) => {
      setPendingMemberId(id)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          members: (old.members ?? []).map((member) =>
            member.id === id ? { ...member, status: nextStatus } : member,
          ),
        }
      })

      return { previous }
    },
    onSuccess: (_result, { status: nextStatus }) => {
      toast({
        title: 'Member status updated',
        description: `Status changed to ${nextStatus.toLowerCase()}.`,
      })
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast({
        variant: 'destructive',
        title: 'Unable to update status',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      setPendingMemberId(null)
      queryClient.invalidateQueries({ queryKey })
    },
  })

  useEffect(() => {
    if (!isCreateOpen) {
      reset({ ...memberFormDefaults })
    }
  }, [isCreateOpen, reset])

  const filteredMembers = useMemo(() => {
    if (!data?.members) return []
    if (!query) return data.members

    return data.members.filter((member) => {
      const normalizedQuery = query.toLowerCase()
      return [member.first_name, member.last_name, member.email, member.membership_plan]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [data?.members, query])

  const isRefreshing = isFetching && Boolean(data)

  if (loading && !data) {
    return <MembersSkeleton />
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load members</AlertTitle>
            <AlertDescription>{error.detail ?? 'Please try again later.'}</AlertDescription>
          </Alert>
          <Button onClick={refresh}>Retry</Button>
        </div>
      </div>
    )
  }

  const handleCreateSubmit = handleSubmit((values) => {
    const payload = {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      membership_plan: values.membership_plan ?? undefined,
      status: values.status,
    }

    createMemberMutation.mutate(payload, {
      onSuccess: () => {
        reset({ ...memberFormDefaults })
      },
    })
  })

  const handleChangeStatus = useCallback(
    (id, nextStatus) => {
      updateStatusMutation.mutate({ id, status: nextStatus })
    },
    [updateStatusMutation],
  )

  const handleLogPayment = useCallback(
    (member) => {
      toast({
        title: 'Log payment coming soon',
        description: `A dedicated flow for ${member.first_name} ${member.last_name} will ship in Phase 6.`,
      })
    },
    [toast],
  )

  const columns = useMemo(
    () => [
      {
        id: 'name',
        accessorFn: (member) => `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim(),
        header: 'Member',
        cell: ({ row }) => {
          const member = row.original
          return (
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-xs text-slate-500">{member.email}</p>
            </div>
          )
        },
        meta: {
          exportValue: (member) => `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim(),
        },
        size: 260,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const member = row.original
          return <Badge variant={badgeVariantForStatus(member.status)}>{member.status}</Badge>
        },
        meta: {
          exportValue: (member) => member.status ?? '',
        },
        size: 120,
      },
      {
        id: 'plan',
        accessorFn: (member) => member.membership_plan ?? '',
        header: 'Plan',
        cell: ({ row }) => {
          const member = row.original
          return (
            <div>
              <p className="text-sm text-slate-900">{member.membership_plan ?? 'Not assigned'}</p>
              <p className="text-xs text-slate-500">Joined {formatDate(member.join_date)}</p>
            </div>
          )
        },
        meta: {
          exportValue: (member) => member.membership_plan ?? '',
        },
        size: 200,
      },
      {
        accessorKey: 'next_payment_due',
        id: 'billing',
        header: 'Billing',
        cell: ({ row }) => {
          const member = row.original
          return <div className="text-sm text-slate-900">Due {formatDate(member.next_payment_due)}</div>
        },
        meta: {
          exportValue: (member) => formatDate(member.next_payment_due),
        },
        size: 160,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <MemberRowActions
            member={row.original}
            onChangeStatus={handleChangeStatus}
            onLogPayment={handleLogPayment}
            isUpdating={pendingMemberId === row.original.id && updateStatusMutation.isPending}
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
    [handleChangeStatus, handleLogPayment, pendingMemberId, updateStatusMutation.isPending],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Track member status, billing, and plan information.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Add Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a member</DialogTitle>
              <DialogDescription>Capture the essentials and we&apos;ll sync the rest once the backend is ready.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreateSubmit} noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="member-first-name">
                    First name
                  </label>
                  <Input
                    id="member-first-name"
                    placeholder="Alex"
                    disabled={createMemberMutation.isPending}
                    aria-invalid={Boolean(errors.first_name)}
                    {...register('first_name')}
                  />
                  {errors.first_name ? (
                    <p className="text-xs text-destructive">{errors.first_name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="member-last-name">
                    Last name
                  </label>
                  <Input
                    id="member-last-name"
                    placeholder="Johnson"
                    disabled={createMemberMutation.isPending}
                    aria-invalid={Boolean(errors.last_name)}
                    {...register('last_name')}
                  />
                  {errors.last_name ? (
                    <p className="text-xs text-destructive">{errors.last_name.message}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <label className="font-medium text-slate-700" htmlFor="member-email">
                  Email
                </label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="alex@example.com"
                  disabled={createMemberMutation.isPending}
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="member-plan">
                    Membership plan
                  </label>
                  <Input
                    id="member-plan"
                    placeholder="Premium"
                    disabled={createMemberMutation.isPending}
                    {...register('membership_plan')}
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <label className="font-medium text-slate-700" htmlFor="member-status">
                    Status
                  </label>
                  <Select
                    id="member-status"
                    disabled={createMemberMutation.isPending}
                    aria-invalid={Boolean(errors.status)}
                    {...register('status')}
                  >
                    {memberStatusOptions.map((option) => (
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
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreateOpen(false)
                    reset({ ...memberFormDefaults })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMemberMutation.isPending}>
                  {createMemberMutation.isPending ? 'Saving…' : 'Create member'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      {isRefreshing ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Spinner size="sm" className="text-primary" />
          Syncing the latest member data…
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={filteredMembers}
        exportFileName="members-export.csv"
        emptyState={{ title: 'No members found', description: 'Try adjusting filters or add a new member.' }}
        toolbarContent={(
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members"
              className="w-full sm:w-64"
            />
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
            <Button variant="secondary" onClick={refresh} disabled={isFetching}>
              Refresh
            </Button>
          </>
        )}
      />
    </div>
  )
}

function badgeVariantForStatus(status) {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'success'
    case 'INACTIVE':
      return 'secondary'
    case 'SUSPENDED':
      return 'warning'
    default:
      return 'info'
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

function MemberRowActions({ member, onChangeStatus, onLogPayment, isUpdating }) {
  const nextStatus = (member.status ?? '').toUpperCase() === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
      <MemberDetailsSheet
        member={member}
        onChangeStatus={onChangeStatus}
        onLogPayment={onLogPayment}
        isUpdating={isUpdating}
        nextStatus={nextStatus}
      />
      <div className="hidden items-center gap-2 sm:flex">
        <Button variant="ghost" size="sm" onClick={() => onLogPayment(member)}>
          Log payment
        </Button>
        <Button
          size="sm"
          variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'}
          onClick={() => onChangeStatus(member.id, nextStatus)}
          disabled={isUpdating}
        >
          {isUpdating ? 'Updating…' : nextStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}

function MemberDetailsSheet({ member, onChangeStatus, onLogPayment, isUpdating, nextStatus }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:hidden">
          View
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto sm:hidden">
        <SheetHeader>
          <SheetTitle>
            {member.first_name} {member.last_name}
          </SheetTitle>
          {member.email ? <SheetDescription>{member.email}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6 space-y-4 text-sm text-slate-600">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 font-medium text-foreground">{member.status ?? 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Membership plan</p>
            <p className="mt-1 font-medium text-foreground">{member.membership_plan ?? 'Not assigned'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
            <p className="mt-1 font-medium text-foreground">{formatDate(member.join_date)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Next payment due</p>
            <p className="mt-1 font-medium text-foreground">{formatDate(member.next_payment_due)}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={() => {
              onLogPayment(member)
              setOpen(false)
            }}
          >
            Log payment
          </Button>
          <Button
            variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'}
            disabled={isUpdating}
            onClick={() => {
              onChangeStatus(member.id, nextStatus)
              setOpen(false)
            }}
          >
            {isUpdating ? 'Updating…' : nextStatus === 'SUSPENDED' ? 'Suspend member' : 'Activate member'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MembersSkeleton() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>

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
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full md:w-44" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
