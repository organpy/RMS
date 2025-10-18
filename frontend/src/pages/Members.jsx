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
import Checkbox from '../components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCommand } from '@/hooks/useCommand'

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
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [isBulkUpdating, setBulkUpdating] = useState(false)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const handleCommandOpenCreate = useCallback(() => {
    setCreateOpen(true)
  }, [])

  const handleCommandFilterStatus = useCallback(
    ({ status: nextStatus, message }) => {
      if (!nextStatus) return
      const matchingOption = statusOptions.find(
        (option) => option.value.toUpperCase() === nextStatus.toUpperCase(),
      )
      const valueToSet = matchingOption?.value ?? nextStatus

  setStatus(valueToSet)
  setSearchTerm('')
  setPage(1)

      const statusLabel = matchingOption?.label
      const description =
        message ??
        (statusLabel
          ? `Showing ${statusLabel.toLowerCase()} members.`
          : `Filter applied for ${valueToSet.toString().toLowerCase()} members.`)

      toast({
        title: 'Filter applied',
        description,
      })
    },
    [toast],
  )

  useCommand('members.openCreate', handleCommandOpenCreate)
  useCommand('members.filterStatus', handleCommandFilterStatus)

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
  members,
  loading,
    error,
    refresh,
    isFetching,
    queryKey,
  } = useMembers({ status, search: searchTerm.trim(), page, pageSize })

  const createMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: (nextMember) => {
      toast({
        title: 'Member added',
        description: `${nextMember?.first_name ?? 'New'} ${nextMember?.last_name ?? 'member'} was created.`,
      })
      setCreateOpen(false)
      reset({ ...memberFormDefaults })
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (mutationError) => {
      toast({
        variant: 'destructive',
        title: 'Unable to add member',
        description: mutationError?.detail ?? 'Please try again later.',
      })
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
    if (!members?.length) return members

    const normalizedQuery = searchTerm.trim().toLowerCase()
    if (!normalizedQuery) {
      return members
    }

    return members.filter((member) =>
      [member.first_name, member.last_name, member.email, member.membership_plan]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    )
  }, [members, searchTerm])

  const decoratedMembers = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return filteredMembers.map((member) => ({
      ...member,
      rowClassName: resolveMemberRowClassName(member, today),
    }))
  }, [filteredMembers])

  const visibleMemberIds = useMemo(() => decoratedMembers.map((member) => member.id), [decoratedMembers])

  const selectedMemberIdsSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds])

  useEffect(() => {
    setSelectedMemberIds((previous) => {
      const filtered = previous.filter((id) => visibleMemberIds.includes(id))
      return filtered.length === previous.length ? previous : filtered
    })
  }, [visibleMemberIds])

  const allVisibleSelected = visibleMemberIds.length > 0 && visibleMemberIds.every((id) => selectedMemberIdsSet.has(id))
  const someVisibleSelected = selectedMemberIds.length > 0 && !allVisibleSelected
  const hasSelection = selectedMemberIds.length > 0

  const isRefreshing = isFetching && members.length > 0

  const handleCreateSubmit = handleSubmit((values) => {
    const payload = {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      membership_plan: values.membership_plan ?? undefined,
      status: values.status,
    }

    createMemberMutation.mutate(payload)
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

  const handleToggleMemberSelection = useCallback((memberId, checked) => {
    setSelectedMemberIds((previous) => {
      if (checked) {
        if (previous.includes(memberId)) {
          return previous
        }
        return [...previous, memberId]
      }
      return previous.filter((id) => id !== memberId)
    })
  }, [])

  const handleSelectAllVisible = useCallback(
    (checked) => {
      setSelectedMemberIds((previous) => {
        if (checked) {
          const merged = new Set([...previous, ...visibleMemberIds])
          return Array.from(merged)
        }
        return previous.filter((id) => !visibleMemberIds.includes(id))
      })
    },
    [visibleMemberIds],
  )

  const clearSelection = useCallback(() => {
    setSelectedMemberIds([])
  }, [])

  const handleBulkChangeStatus = useCallback(
    async (nextStatus) => {
      if (!selectedMemberIds.length) return

      const uppercaseStatus = nextStatus.toUpperCase()
      const idsToUpdate = [...selectedMemberIds]

      setBulkUpdating(true)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          members: (old.members ?? []).map((member) =>
            idsToUpdate.includes(member.id) ? { ...member, status: uppercaseStatus } : member,
          ),
        }
      })

      try {
        await Promise.all(idsToUpdate.map((id) => updateMemberStatus(id, { status: uppercaseStatus })))
        toast({
          title: 'Members updated',
          description: `Marked ${idsToUpdate.length} member${idsToUpdate.length === 1 ? '' : 's'} as ${uppercaseStatus.toLowerCase()}.`,
        })
        setSelectedMemberIds([])
      } catch (mutationError) {
        if (previous) {
          queryClient.setQueryData(queryKey, previous)
        }
        toast({
          variant: 'destructive',
          title: 'Bulk update failed',
          description: mutationError?.detail ?? 'Please try again later.',
        })
      } finally {
        setBulkUpdating(false)
        queryClient.invalidateQueries({ queryKey })
      }
    },
    [queryClient, queryKey, selectedMemberIds, toast],
  )

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all members"
            checked={allVisibleSelected && visibleMemberIds.length > 0}
            indeterminate={someVisibleSelected}
            disabled={!visibleMemberIds.length}
            onChange={(event) => handleSelectAllVisible(event.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.first_name ?? 'member'}`}
            checked={selectedMemberIdsSet.has(row.original.id)}
            onChange={(event) => handleToggleMemberSelection(row.original.id, event.target.checked)}
            className="mx-auto"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: 'w-12 text-center',
          cellClassName: 'w-12 text-center',
          exportValue: () => '',
          skipExport: true,
        },
        size: 48,
      },
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
    [
      allVisibleSelected,
      handleChangeStatus,
      handleLogPayment,
      handleSelectAllVisible,
      handleToggleMemberSelection,
      pendingMemberId,
      selectedMemberIdsSet,
      someVisibleSelected,
      updateStatusMutation.isPending,
      visibleMemberIds,
    ],
  )

  if (loading && !members.length) {
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

      {hasSelection ? (
        <BulkActionsBar
          count={selectedMemberIds.length}
          onMarkActive={() => handleBulkChangeStatus('ACTIVE')}
          onMarkInactive={() => handleBulkChangeStatus('INACTIVE')}
          onSuspend={() => handleBulkChangeStatus('SUSPENDED')}
          onClear={clearSelection}
          disabled={isBulkUpdating}
        />
      ) : null}

      <DataTable
        columns={columns}
        data={decoratedMembers}
        exportFileName="members-export.csv"
        emptyState={{ title: 'No members found', description: 'Try adjusting filters or add a new member.' }}
        toolbarContent={(
          <>
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setPage(1)
              }}
              placeholder="Search members"
              className="w-full sm:w-64"
            />
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
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

function resolveMemberRowClassName(member, today) {
  const status = (member.status ?? '').toUpperCase()
  if (status === 'INACTIVE') {
    return 'bg-slate-50'
  }
  if (status === 'SUSPENDED') {
    return 'bg-amber-50/60'
  }

  if (member.next_payment_due) {
    const dueDate = new Date(member.next_payment_due)
    if (!Number.isNaN(dueDate.getTime())) {
      const normalizedDue = new Date(dueDate)
      normalizedDue.setHours(0, 0, 0, 0)
      if (normalizedDue < today) {
        return 'bg-rose-50/80'
      }
    }
  }

  return ''
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

function BulkActionsBar({ count, onMarkActive, onMarkInactive, onSuspend, onClear, disabled }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
      <p className="font-medium">
        {count} member{count === 1 ? '' : 's'} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onMarkActive} disabled={disabled}>
          Mark active
        </Button>
        <Button size="sm" variant="secondary" onClick={onMarkInactive} disabled={disabled}>
          Mark inactive
        </Button>
        <Button size="sm" variant="danger" onClick={onSuspend} disabled={disabled}>
          Suspend
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={disabled}>
          Clear
        </Button>
      </div>
    </div>
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
