import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useMembers, createMember, updateMember, updateMemberStatus, deleteMember } from '../hooks/useMembers'
import { useMemberFilters } from '../hooks/useMemberFilters'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCommand } from '@/hooks/useCommand'
import { MemberForm } from '../components/members/MemberForm'
import { memberFormDefaults, memberFormSchema } from '../components/members/memberFormSchema'
import { MemberDetailsPanel } from '../components/members/MemberDetailsPanel'
import { useMemberPaymentHistory } from '../hooks/useMemberPaymentHistory'
import { emitCommand } from '@/lib/commandBus'

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

export default function Members() {
  const [status, setStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [classFilter, setClassFilter] = useState('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [isEditOpen, setEditOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [isDetailsOpen, setDetailsOpen] = useState(false)
  const [detailMember, setDetailMember] = useState(null)
  const [memberPendingDelete, setMemberPendingDelete] = useState(null)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [isBulkUpdating, setBulkUpdating] = useState(false)
  const [isBulkNotifying, setBulkNotifying] = useState(false)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { classOptions, groupOptions, loading: filtersLoading } = useMemberFilters()

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
      setClassFilter('ALL')
      setGroupFilter('ALL')
      setSelectedMemberIds([])
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

  const normalizedClassId = classFilter === 'ALL' ? undefined : Number(classFilter)
  const normalizedGroupId = groupFilter === 'ALL' ? undefined : Number(groupFilter)

  const groupSelectOptions = useMemo(() => {
    if (!groupOptions?.length) return []
    if (normalizedClassId == null) {
      return groupOptions.map((option) => ({
        value: option.value,
        displayLabel: `${option.label} (${option.className})`,
        classId: option.classId,
      }))
    }

    return groupOptions
      .filter((option) => option.classId === normalizedClassId)
      .map((option) => ({
        value: option.value,
        displayLabel: option.label,
        classId: option.classId,
      }))
  }, [groupOptions, normalizedClassId])

  useEffect(() => {
    if (groupFilter === 'ALL') return

    const candidate = groupOptions?.find((option) => option.value === groupFilter)
    if (!candidate) {
      setGroupFilter('ALL')
      return
    }

    if (normalizedClassId != null && candidate.classId !== normalizedClassId) {
      setGroupFilter('ALL')
    }
  }, [groupFilter, groupOptions, normalizedClassId, setGroupFilter])

  const handleSearchChange = useCallback(
    (value) => {
      setSearchTerm(value)
      setPage(1)
      setSelectedMemberIds([])
    },
    [setPage, setSearchTerm, setSelectedMemberIds],
  )

  const handleStatusFilterChange = useCallback(
    (nextStatus) => {
      setStatus(nextStatus)
      setPage(1)
      setSelectedMemberIds([])
    },
    [setPage, setSelectedMemberIds, setStatus],
  )

  const handleClassFilterChange = useCallback(
    (nextClassId) => {
      setClassFilter(nextClassId)
      setPage(1)
      setSelectedMemberIds([])
    },
    [setClassFilter, setPage, setSelectedMemberIds],
  )

  const handleGroupFilterChange = useCallback(
    (nextGroupId) => {
      setGroupFilter(nextGroupId)
      setPage(1)
      setSelectedMemberIds([])
    },
    [setGroupFilter, setPage, setSelectedMemberIds],
  )

  const groupSelectPlaceholder = normalizedClassId ? 'All groups in class' : 'All groups'

  const createForm = useForm({
    resolver: zodResolver(memberFormSchema),
    defaultValues: memberFormDefaults,
  })

  const editForm = useForm({
    resolver: zodResolver(memberFormSchema),
    defaultValues: memberFormDefaults,
  })

  const { members, meta, loading, error, refresh, isFetching, queryKey } = useMembers({
    status,
    search: searchTerm.trim(),
    page,
    pageSize,
    classId: normalizedClassId,
    groupId: normalizedGroupId,
  })

  const {
    payments: detailPayments,
    loading: detailPaymentsLoading,
    refresh: refreshDetailPayments,
  } = useMemberPaymentHistory(detailMember?.id, { enabled: isDetailsOpen })

  const createMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: (nextMember) => {
      toast({
        title: 'Member added',
        description: `${nextMember?.first_name ?? 'New'} ${nextMember?.last_name ?? 'member'} was created.`,
      })
      setCreateOpen(false)
      createForm.reset({ ...memberFormDefaults })
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

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, values }) => updateMember(id, values),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          members: (old.members ?? []).map((member) =>
            member.id === id ? { ...member, ...values } : member,
          ),
        }
      })

      setEditingMember((current) => (current && current.id === id ? { ...current, ...values } : current))

      return { previous }
    },
    onSuccess: (result, { values }) => {
      const displayName = `${values.first_name ?? ''} ${values.last_name ?? ''}`.trim() || 'Member'

      toast({
        title: 'Member updated',
        description: `${displayName} details saved.`,
      })

      setEditOpen(false)
      if (result) {
        setEditingMember(result)
      }
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast({
        variant: 'destructive',
        title: 'Unable to update member',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
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

  const deleteMemberMutation = useMutation({
    mutationFn: ({ id }) => deleteMember(id),
    onMutate: async ({ id, member }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        const filteredMembers = (old.members ?? []).filter((entry) => entry.id !== id)
        const nextMeta = old.meta
          ? {
              ...old.meta,
              total: Math.max(0, (old.meta.total ?? filteredMembers.length) - 1),
            }
          : old.meta

        return {
          ...old,
          members: filteredMembers,
          meta: nextMeta,
        }
      })

      const previousSelection = selectedMemberIds
      setSelectedMemberIds((prev) => prev.filter((selectedId) => selectedId !== id))

      return { previous, member, previousSelection }
    },
    onSuccess: (_result, { member }) => {
      const displayName = member
        ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || member.email || 'Member'
        : 'Member'

      toast({
        title: 'Member removed',
        description: `${displayName} was removed from the roster.`,
      })

      setDeleteDialogOpen(false)
      setMemberPendingDelete(null)
      setDetailMember((current) => {
        if (current?.id === member?.id) {
          setDetailsOpen(false)
          return null
        }
        return current
      })
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      if (context?.previousSelection) {
        setSelectedMemberIds(context.previousSelection)
      }
      toast({
        variant: 'destructive',
        title: 'Unable to remove member',
        description: mutationError?.detail ?? 'Please try again later.',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey })
    },
  })

  useEffect(() => {
    if (!isCreateOpen) {
      createForm.reset({ ...memberFormDefaults })
    }
  }, [createForm, isCreateOpen])

  useEffect(() => {
    if (!isEditOpen) {
      editForm.reset({ ...memberFormDefaults })
      setEditingMember(null)
    }
  }, [editForm, isEditOpen])

  useEffect(() => {
    if (!isDetailsOpen) {
      setDeleteDialogOpen(false)
      setMemberPendingDelete(null)
    }
  }, [isDetailsOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(min-width: 640px)')
    const handleChange = (event) => setIsDesktop(event.matches)

    setIsDesktop(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

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

  const totalCount = meta?.total ?? members.length
  const pageLimit = meta?.limit ?? pageSize

  const isDetailStatusUpdating =
    detailMember != null && pendingMemberId === detailMember.id && updateStatusMutation.isPending
  const isDetailDeleting =
    detailMember != null && memberPendingDelete?.id === detailMember.id && deleteMemberMutation.isPending

  useEffect(() => {
    if (!meta) return
    const limit = meta.limit ?? pageSize
    const total = meta.total ?? 0
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1

    if (total === 0 && page !== 1) {
      setPage(1)
      return
    }

    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [meta, page, pageSize])

  const handlePageChange = useCallback(
    (nextPage) => {
      if (!Number.isFinite(nextPage) || nextPage < 1) return
      setPage(nextPage)
    },
    [setPage],
  )

  const handleCreateMember = useCallback(
    (values) => {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        membership_plan: values.membership_plan ?? undefined,
        status: values.status,
      }

      createMemberMutation.mutate(payload)
    },
    [createMemberMutation],
  )

  const handleChangeStatus = useCallback(
    (id, nextStatus) => {
      updateStatusMutation.mutate({ id, status: nextStatus })
    },
    [updateStatusMutation],
  )

  const handleRecordPayment = useCallback(
    (member) => {
      if (!member) return

      const fullName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
      const memberName = fullName || member.email || 'Member'

      emitCommand(
        'payments.openCreate',
        {
          member_id: member.id,
          member_name: memberName,
          membership_plan: member.membership_plan ?? '',
        },
        { persist: true },
      )

      setDetailsOpen(false)
      setDetailMember(null)
      setEditOpen(false)
      setEditingMember(null)

      navigate('/payments')
    },
    [navigate],
  )

  const handleSendReminder = useCallback(
    (member) => {
      if (!member) return

      const fullName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
      const target = fullName || member.email || 'this member'

      toast({
        title: 'Reminder queued',
        description: `We'll remind ${target} about their outstanding balance.`,
      })
    },
    [toast],
  )

  const handleOpenEdit = useCallback(
    (member) => {
      if (!member) return
      setEditingMember(member)
      editForm.reset({
        first_name: member.first_name ?? '',
        last_name: member.last_name ?? '',
        email: member.email ?? '',
        membership_plan: member.membership_plan ?? '',
        status: normalizeMemberStatus(member.status),
      })
      setEditOpen(true)
      setDetailsOpen(false)
      setDetailMember(null)
    },
    [editForm],
  )

  const handleEditMember = useCallback(
    (values) => {
      if (!editingMember) return

      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        membership_plan: values.membership_plan ?? undefined,
        status: values.status,
      }

      updateMemberMutation.mutate({ id: editingMember.id, values: payload })
    },
    [editingMember, updateMemberMutation],
  )

  const handleEditOpenChange = useCallback((nextOpen) => {
    if (!nextOpen) {
      setEditOpen(false)
    }
  }, [])

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false)
  }, [])

  const handleViewMember = useCallback((member) => {
    if (!member) return
    setDetailMember(member)
    setDetailsOpen(true)
  }, [])

  const handleDetailsOpenChange = useCallback((nextOpen) => {
    setDetailsOpen(nextOpen)
    if (!nextOpen) {
      setDetailMember(null)
    }
  }, [])

  const handleRequestDelete = useCallback((member) => {
    if (!member) return
    setMemberPendingDelete(member)
    setDeleteDialogOpen(true)
  }, [])

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false)
    setMemberPendingDelete(null)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!memberPendingDelete) return
    deleteMemberMutation.mutate({ id: memberPendingDelete.id, member: memberPendingDelete })
  }, [deleteMemberMutation, memberPendingDelete])

  const handleDetailStatusChange = useCallback(
    (member, nextStatus) => {
      if (!member) return
      handleChangeStatus(member.id, nextStatus)
    },
    [handleChangeStatus],
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

  const handleBulkSendReminder = useCallback(async () => {
    if (!selectedMemberIds.length) return

    setBulkNotifying(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 400))

      toast({
        title: 'Reminders queued',
        description: `We will remind ${selectedMemberIds.length} member${selectedMemberIds.length === 1 ? '' : 's'} about their outstanding balances once messaging is wired up.`,
      })
    } finally {
      setBulkNotifying(false)
    }
  }, [selectedMemberIds, toast])

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
            onView={handleViewMember}
            onChangeStatus={handleChangeStatus}
            onRecordPayment={handleRecordPayment}
            onSendReminder={handleSendReminder}
            onEdit={handleOpenEdit}
            isUpdating={pendingMemberId === row.original.id && updateStatusMutation.isPending}
            isEditing={editingMember?.id === row.original.id && updateMemberMutation.isPending}
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
      handleOpenEdit,
      handleRecordPayment,
      handleSendReminder,
      handleViewMember,
      handleSelectAllVisible,
      handleToggleMemberSelection,
      pendingMemberId,
      editingMember,
      selectedMemberIdsSet,
      someVisibleSelected,
      updateMemberMutation.isPending,
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
            <MemberForm
              form={createForm}
              onSubmit={handleCreateMember}
              onCancel={() => {
                setCreateOpen(false)
                createForm.reset({ ...memberFormDefaults })
              }}
              isSubmitting={createMemberMutation.isPending}
              submitLabel="Create member"
            />
          </DialogContent>
        </Dialog>
        {isDesktop ? (
          <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? `Edit ${editingMember.first_name} ${editingMember.last_name}` : 'Edit member'}
                </DialogTitle>
                <DialogDescription>Update member profile details and status.</DialogDescription>
              </DialogHeader>
              <MemberForm
                form={editForm}
                onSubmit={handleEditMember}
                onCancel={handleCloseEdit}
                isSubmitting={updateMemberMutation.isPending}
                submitLabel="Save changes"
                cancelLabel="Close"
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet open={isEditOpen} onOpenChange={handleEditOpenChange}>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingMember ? `Edit ${editingMember.first_name} ${editingMember.last_name}` : 'Edit member'}
                </SheetTitle>
                <SheetDescription>Make quick changes while staying on the members list.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <MemberForm
                  form={editForm}
                  onSubmit={handleEditMember}
                  onCancel={handleCloseEdit}
                  isSubmitting={updateMemberMutation.isPending}
                  submitLabel="Save changes"
                  cancelLabel="Close"
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
        {isDesktop ? (
          <Dialog open={isDetailsOpen} onOpenChange={handleDetailsOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {detailMember ? `${detailMember.first_name} ${detailMember.last_name}` : 'Member details'}
                </DialogTitle>
                <DialogDescription>Review recent activity and member insights.</DialogDescription>
              </DialogHeader>
              <MemberDetailsPanel
                member={detailMember}
                payments={detailPayments}
                paymentsLoading={detailPaymentsLoading}
                onEdit={handleOpenEdit}
                onRecordPayment={handleRecordPayment}
                onSendReminder={handleSendReminder}
                onChangeStatus={handleDetailStatusChange}
                onRequestDelete={handleRequestDelete}
                onRefreshPayments={refreshDetailPayments}
                isUpdatingStatus={isDetailStatusUpdating}
                isDeleting={isDetailDeleting}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet open={isDetailsOpen} onOpenChange={handleDetailsOpenChange}>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {detailMember ? `${detailMember.first_name} ${detailMember.last_name}` : 'Member details'}
                </SheetTitle>
                <SheetDescription>Review recent activity and member insights.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <MemberDetailsPanel
                  member={detailMember}
                  payments={detailPayments}
                  paymentsLoading={detailPaymentsLoading}
                  onEdit={handleOpenEdit}
                  onRecordPayment={handleRecordPayment}
                  onSendReminder={handleSendReminder}
                  onChangeStatus={handleDetailStatusChange}
                  onRequestDelete={handleRequestDelete}
                  onRefreshPayments={refreshDetailPayments}
                  isUpdatingStatus={isDetailStatusUpdating}
                  isDeleting={isDetailDeleting}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
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
          onSendReminder={handleBulkSendReminder}
          onClear={clearSelection}
          disabled={isBulkUpdating || isBulkNotifying}
        />
      ) : null}

      <DataTable
        columns={columns}
        data={decoratedMembers}
        exportFileName="members-export.csv"
        emptyState={{ title: 'No members found', description: 'Try adjusting filters or add a new member.' }}
        page={page}
        pageSize={pageLimit}
        totalCount={totalCount}
        onPageChange={handlePageChange}
        isPageLoading={isFetching}
        toolbarContent={(
          <>
            <Input
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search members"
              className="w-full sm:w-64"
            />
            <Select
              value={status}
              onChange={(event) => handleStatusFilterChange(event.target.value)}
              className="w-full sm:w-48"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={classFilter}
              onChange={(event) => handleClassFilterChange(event.target.value)}
              className="w-full sm:w-48"
              disabled={filtersLoading}
            >
              <option value="ALL">All classes</option>
              {classOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={groupFilter}
              onChange={(event) => handleGroupFilterChange(event.target.value)}
              className="w-full sm:w-56"
              disabled={filtersLoading || (!groupOptions?.length && groupFilter === 'ALL')}
            >
              <option value="ALL">{groupSelectPlaceholder}</option>
              {groupSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.displayLabel}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={refresh} disabled={isFetching}>
              Refresh
            </Button>
          </>
        )}
      />

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleCancelDelete()
          } else {
            setDeleteDialogOpen(true)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {memberPendingDelete
                ? `This will archive ${memberPendingDelete.first_name ?? ''} ${memberPendingDelete.last_name ?? ''} and remove them from active views.`
                : 'This will archive the member and remove them from active views.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCancelDelete} disabled={deleteMemberMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete} disabled={deleteMemberMutation.isPending}>
              {deleteMemberMutation.isPending ? 'Removing…' : 'Remove member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function normalizeMemberStatus(status) {
  const normalized = (status ?? '').toString().toUpperCase()
  return ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(normalized) ? normalized : 'ACTIVE'
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

function MemberRowActions({
  member,
  onView,
  onEdit,
  onChangeStatus,
  onRecordPayment,
  onSendReminder,
  isUpdating,
  isEditing,
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
        <Button variant="secondary" size="sm" onClick={() => onEdit(member)} disabled={isEditing}>
          {isEditing ? 'Saving…' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'}
          onClick={() => onChangeStatus(member.id, nextStatus)}
          disabled={isUpdating}
        >
          {isUpdating ? 'Updating…' : nextStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onView(member)}>
          Details
        </Button>
      </div>
    </div>
  )
}

function BulkActionsBar({ count, onMarkActive, onMarkInactive, onSuspend, onSendReminder, onClear, disabled }) {
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
