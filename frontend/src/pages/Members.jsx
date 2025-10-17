import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
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

export default function Members() {
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()

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

  const handleCreateSubmit = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      first_name: formData.get('first_name')?.toString().trim() || undefined,
      last_name: formData.get('last_name')?.toString().trim() || undefined,
      email: formData.get('email')?.toString().trim() || undefined,
      membership_plan: formData.get('membership_plan')?.toString().trim() || undefined,
      status: formData.get('status')?.toString() || 'ACTIVE',
    }

    createMemberMutation.mutate(payload, {
      onSuccess: () => {
        form.reset()
      },
    })
  }

  const handleChangeStatus = (id, nextStatus) => {
    updateStatusMutation.mutate({ id, status: nextStatus })
  }

  const handleLogPayment = (member) => {
    toast({
      title: 'Log payment coming soon',
      description: `A dedicated flow for ${member.first_name} ${member.last_name} will ship in Phase 6.`,
    })
  }

  const columns = [
    {
      key: 'name',
      header: 'Member',
      render: (member) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {member.first_name} {member.last_name}
          </p>
          <p className="text-xs text-slate-500">{member.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => <Badge variant={badgeVariantForStatus(member.status)}>{member.status}</Badge>,
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (member) => (
        <div>
          <p className="text-sm text-slate-900">{member.membership_plan ?? 'Not assigned'}</p>
          <p className="text-xs text-slate-500">Joined {formatDate(member.join_date)}</p>
        </div>
      ),
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (member) => (
        <div className="text-sm text-slate-900">Due {formatDate(member.next_payment_due)}</div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (member) => (
        <MemberRowActions
          member={member}
          onChangeStatus={handleChangeStatus}
          onLogPayment={handleLogPayment}
          isUpdating={pendingMemberId === member.id && updateStatusMutation.isPending}
        />
      ),
    },
  ]

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
            <form className="space-y-4" onSubmit={handleCreateSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">First name</span>
                  <Input name="first_name" placeholder="Alex" required />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Last name</span>
                  <Input name="last_name" placeholder="Johnson" required />
                </label>
              </div>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Email</span>
                <Input name="email" type="email" placeholder="alex@example.com" required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Membership plan</span>
                  <Input name="membership_plan" placeholder="Premium" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Status</span>
                  <Select name="status" defaultValue="ACTIVE">
                    {memberStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
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

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full flex-1 sm:w-auto">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          data={filteredMembers}
          emptyState={{ title: 'No members found', description: 'Try adjusting filters or add a new member.' }}
        />
      </Card>
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
  const nextStatus = member.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'

  return (
    <div className="flex flex-wrap justify-end gap-2">
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
