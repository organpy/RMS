import { useCallback, useEffect, useMemo } from 'react'
import DataTable from '../data/DataTable'
import Checkbox from '../ui/Checkbox'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import Card from '../ui/Card'
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert'
import { Skeleton } from '../ui/skeleton'
import {
  badgeVariantForStatus,
  formatMemberDate,
  formatStatusDisplay,
  normalizeMemberStatus,
  resolveMemberRowClassName,
} from '@/utils/members'

function MemberRowActions({
  member,
  onView,
  onEdit,
  onChangeStatus,
  onRecordPayment,
  onSendReminder,
  isStatusUpdating,
  isEditPending,
}) {
  const nextStatus = (member.status ?? '').toUpperCase() === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-2 sm:hidden">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(member)}>
          View details
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRecordPayment(member)}>
          Record
        </Button>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Button variant="ghost" size="sm" onClick={() => onRecordPayment(member)}>
          Log payment
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onSendReminder(member)}>
          Reminder
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onEdit(member)} disabled={isEditPending}>
          {isEditPending ? 'Saving…' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'}
          onClick={() => onChangeStatus(member.id, nextStatus)}
          disabled={isStatusUpdating}
        >
          {isStatusUpdating ? 'Updating…' : nextStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onView(member)}>
          Details
        </Button>
      </div>
    </div>
  )
}

function BulkActionsBar({
  count,
  summary,
  onMarkActive,
  onMarkInactive,
  onSuspend,
  onSendReminder,
  onClear,
  disabled,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">
          {count} member{count === 1 ? '' : 's'} selected
        </p>
        {summary ? <p className="text-xs text-primary/80">Status breakdown: {summary}</p> : null}
        <p className="mt-1 text-xs text-primary/70">
          Keep this selection to batch future exports and messaging actions as they roll out.
        </p>
      </div>
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
        <Button size="sm" variant="secondary" onClick={onSendReminder} disabled={disabled}>
          Send reminders
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

export function MemberTable({
  members,
  searchTerm,
  loading,
  error,
  onRetry,
  meta,
  isFetching,
  page,
  pageSize,
  onPageChange,
  selectedMemberIds,
  setSelectedMemberIds,
  onViewMember,
  onEditMember,
  onChangeStatus,
  onRecordPayment,
  onSendReminder,
  statusUpdateMemberId,
  isStatusMutating,
  editingMemberId,
  isEditMutating,
  onBulkChangeStatus,
  onBulkSendReminder,
  isBulkUpdating,
  isBulkNotifying,
  toolbarContent,
  statusFilter = 'ALL',
  classFilter = 'ALL',
  groupFilter = 'ALL',
}) {
  const filteredMembers = useMemo(() => {
    if (!members?.length) return members ?? []

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

  useEffect(() => {
    setSelectedMemberIds((previous) => {
      const filtered = previous.filter((id) => visibleMemberIds.includes(id))
      return filtered.length === previous.length ? previous : filtered
    })
  }, [setSelectedMemberIds, visibleMemberIds])

  const selectedMemberIdsSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds])
  const allVisibleSelected = visibleMemberIds.length > 0 && visibleMemberIds.every((id) => selectedMemberIdsSet.has(id))
  const someVisibleSelected = selectedMemberIds.length > 0 && !allVisibleSelected
  const hasSelection = selectedMemberIds.length > 0

  const handleToggleMemberSelection = useCallback(
    (memberId, checked) => {
      setSelectedMemberIds((previous) => {
        if (checked) {
          if (previous.includes(memberId)) {
            return previous
          }
          return [...previous, memberId]
        }
        return previous.filter((id) => id !== memberId)
      })
    },
    [setSelectedMemberIds],
  )

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
    [setSelectedMemberIds, visibleMemberIds],
  )

  const clearSelection = useCallback(() => {
    setSelectedMemberIds([])
  }, [setSelectedMemberIds])

  const selectionSummary = useMemo(() => {
    if (!hasSelection) return ''
    const statusCounts = decoratedMembers.reduce((acc, member) => {
      if (!selectedMemberIdsSet.has(member.id)) return acc
      const status = normalizeMemberStatus(member.status)
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    const statusEntries = Object.entries(statusCounts).map(([status, count]) => `${count} ${formatStatusDisplay(status, count)}`)

    return statusEntries.length ? statusEntries.join(', ') : ''
  }, [decoratedMembers, hasSelection, selectedMemberIdsSet])

  const { emptyStateTitle, emptyStateDescription } = useMemo(() => {
    const trimmedSearch = searchTerm.trim()
    const activeFilters = []

    if (trimmedSearch) {
      activeFilters.push(`search “${trimmedSearch}”`)
    }
    if (statusFilter && statusFilter !== 'ALL') {
      activeFilters.push(`status ${statusFilter.toLowerCase()}`)
    }
    if (classFilter && classFilter !== 'ALL') {
      activeFilters.push('class filter')
    }
    if (groupFilter && groupFilter !== 'ALL') {
      activeFilters.push('group filter')
    }

    if (!activeFilters.length) {
      return {
        emptyStateTitle: 'No members found',
        emptyStateDescription: 'Try adjusting filters or add a new member.',
      }
    }

    const summary = activeFilters.join(', ')
    return {
      emptyStateTitle: 'No members match your filters',
      emptyStateDescription: `No members match your current filters (${summary}). Clear filters or add a new member.`,
    }
  }, [classFilter, groupFilter, searchTerm, statusFilter])

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
              <p className="text-xs text-slate-500">Joined {formatMemberDate(member.join_date)}</p>
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
          return <div className="text-sm text-slate-900">Due {formatMemberDate(member.next_payment_due)}</div>
        },
        meta: {
          exportValue: (member) => formatMemberDate(member.next_payment_due),
        },
        size: 160,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <MemberRowActions
            member={row.original}
            onView={onViewMember}
            onChangeStatus={onChangeStatus}
            onRecordPayment={onRecordPayment}
            onSendReminder={onSendReminder}
            onEdit={onEditMember}
            isStatusUpdating={statusUpdateMemberId === row.original.id && isStatusMutating}
            isEditPending={editingMemberId === row.original.id && isEditMutating}
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
      editingMemberId,
      handleSelectAllVisible,
      handleToggleMemberSelection,
      isEditMutating,
      isStatusMutating,
      onChangeStatus,
      onEditMember,
      onRecordPayment,
      onSendReminder,
      onViewMember,
      selectedMemberIdsSet,
      someVisibleSelected,
      statusUpdateMemberId,
      visibleMemberIds,
    ],
  )

  const memberCount = members?.length ?? 0
  const isRefreshing = isFetching && memberCount > 0
  const totalCount = meta?.total ?? memberCount
  const limit = meta?.limit ?? pageSize

  if (loading && memberCount === 0) {
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
          <Button onClick={onRetry}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isRefreshing ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Spinner size="sm" className="text-primary" />
          Syncing the latest member data…
        </div>
      ) : null}

      {hasSelection ? (
        <BulkActionsBar
          count={selectedMemberIds.length}
          onMarkActive={() => onBulkChangeStatus('ACTIVE', selectedMemberIds)}
          onMarkInactive={() => onBulkChangeStatus('INACTIVE', selectedMemberIds)}
          onSuspend={() => onBulkChangeStatus('SUSPENDED', selectedMemberIds)}
          onSendReminder={() => onBulkSendReminder(selectedMemberIds)}
          onClear={clearSelection}
          disabled={isBulkUpdating || isBulkNotifying}
          summary={selectionSummary}
        />
      ) : null}

      <DataTable
        columns={columns}
        data={decoratedMembers}
        exportFileName="members-export.csv"
        emptyState={{ title: emptyStateTitle, description: emptyStateDescription }}
        page={page}
        pageSize={limit}
        totalCount={totalCount}
        onPageChange={onPageChange}
        isPageLoading={isFetching}
        toolbarContent={toolbarContent}
        virtualizeRows
        virtualRowHeight={56}
        virtualMaxHeight={640}
      />
    </div>
  )
}
