import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMembers, createMember, updateMember, updateMemberStatus, deleteMember } from '../hooks/useMembers'
import { useMemberFilters } from '../hooks/useMemberFilters'
import { useToast } from '@/hooks/use-toast'
import { useCommand } from '@/hooks/useCommand'
import { emitCommand } from '@/lib/commandBus'
import { MemberCreateDialog } from '../components/members/MemberCreateDialog'
import { MemberEditOverlay } from '../components/members/MemberEditOverlay'
import { MemberDetailsOverlay } from '../components/members/MemberDetailsOverlay'
import { MemberDeleteDialog } from '../components/members/MemberDeleteDialog'
import { MemberFilters } from '../components/members/MemberFilters'
import { MemberTable } from '../components/members/MemberTable'
import { memberFormDefaults, memberFormSchema } from '../components/members/memberFormSchema'
import { useMemberPaymentHistory } from '../hooks/useMemberPaymentHistory'
import { normalizeMemberStatus } from '@/utils/members'
import { exportAllMembersCsv } from '@/utils/exporters/members'

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

export default function Members() {
  const [status, setStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const location = useLocation()
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
  const [isExportingAll, setExportingAll] = useState(false)

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

  useEffect(() => {
    if (!location.state) return

    const { focusClassId, focusClassName, focusGroupId, focusGroupName } = location.state

    let changed = false

    if (focusClassId) {
      setClassFilter(String(focusClassId))
      setGroupFilter(focusGroupId ? String(focusGroupId) : 'ALL')
      setStatus('ALL')
      setSearchTerm('')
      changed = true
    } else if (focusGroupId) {
      setGroupFilter(String(focusGroupId))
      setStatus('ALL')
      setSearchTerm('')
      changed = true
    }

    if (changed) {
      setPage(1)
      setSelectedMemberIds([])
      toast({
        title: 'Filter applied',
        description:
          focusGroupName
            ? `Showing members from ${focusGroupName}.`
            : focusClassName
              ? `Showing members enrolled in ${focusClassName}.`
              : 'Member filters updated.',
      })
    }

    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate, toast])
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

  const handleExportAll = useCallback(async () => {
    try {
      setExportingAll(true)
      await exportAllMembersCsv({
        status,
        search: searchTerm,
        classId: normalizedClassId,
        groupId: normalizedGroupId,
      })
    } finally {
      setExportingAll(false)
    }
  }, [normalizedClassId, normalizedGroupId, searchTerm, status])

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

  const { members = [], meta, loading, error, refresh, isFetching, queryKey } = useMembers({
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
    setEditOpen(nextOpen)
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

  const handleBulkChangeStatus = useCallback(
    async (nextStatus, memberIds) => {
      if (!memberIds?.length) return

      const uppercaseStatus = nextStatus.toUpperCase()
      const idsToUpdate = [...memberIds]

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
    [queryClient, queryKey, toast],
  )

  const handleBulkSendReminder = useCallback(
    async (memberIds) => {
      if (!memberIds?.length) return

      setBulkNotifying(true)

      try {
        await new Promise((resolve) => setTimeout(resolve, 400))

        toast({
          title: 'Reminders queued',
          description: `We will remind ${memberIds.length} member${memberIds.length === 1 ? '' : 's'} about their outstanding balances once messaging is wired up.`,
        })
      } finally {
        setBulkNotifying(false)
      }
    },
    [toast],
  )

  const filtersToolbar = useMemo(
    () => (
      <MemberFilters
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        status={status}
        statusOptions={statusOptions}
        onStatusChange={handleStatusFilterChange}
        classFilter={classFilter}
        classOptions={classOptions}
        onClassChange={handleClassFilterChange}
        groupFilter={groupFilter}
        groupSelectOptions={groupSelectOptions}
        groupSelectPlaceholder={groupSelectPlaceholder}
        onGroupChange={handleGroupFilterChange}
        filtersLoading={filtersLoading}
        hasGroupOptions={Boolean(groupOptions?.length)}
        onRefresh={refresh}
        isRefreshing={isFetching}
        onExportAll={handleExportAll}
        isExporting={isExportingAll}
      />
    ),
    [
      classFilter,
      classOptions,
      filtersLoading,
      groupFilter,
      groupOptions,
      groupSelectOptions,
      groupSelectPlaceholder,
      handleClassFilterChange,
      handleGroupFilterChange,
      handleSearchChange,
      handleExportAll,
      handleStatusFilterChange,
      isFetching,
      refresh,
      searchTerm,
      status,
      isExportingAll,
    ],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Track member status, billing, and plan information.</p>
        </div>
        <MemberCreateDialog
          open={isCreateOpen}
          onOpenChange={setCreateOpen}
          form={createForm}
          onSubmit={handleCreateMember}
          onCancel={() => setCreateOpen(false)}
          isSubmitting={createMemberMutation.isPending}
        />
      </section>

      <MemberTable
        members={members}
        searchTerm={searchTerm}
        loading={loading}
        error={error}
        onRetry={refresh}
        meta={meta}
        isFetching={isFetching}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        selectedMemberIds={selectedMemberIds}
        setSelectedMemberIds={setSelectedMemberIds}
        onViewMember={handleViewMember}
        onEditMember={handleOpenEdit}
        onChangeStatus={handleChangeStatus}
        onRecordPayment={handleRecordPayment}
        onSendReminder={handleSendReminder}
        statusUpdateMemberId={pendingMemberId}
        isStatusMutating={updateStatusMutation.isPending}
        editingMemberId={editingMember?.id ?? null}
        isEditMutating={updateMemberMutation.isPending}
        onBulkChangeStatus={handleBulkChangeStatus}
        onBulkSendReminder={handleBulkSendReminder}
        isBulkUpdating={isBulkUpdating}
        isBulkNotifying={isBulkNotifying}
        toolbarContent={filtersToolbar}
      />

      <MemberEditOverlay
        open={isEditOpen}
        isDesktop={isDesktop}
        onOpenChange={handleEditOpenChange}
        member={editingMember}
        form={editForm}
        onSubmit={handleEditMember}
        onCancel={handleCloseEdit}
        isSubmitting={updateMemberMutation.isPending}
      />

      <MemberDetailsOverlay
        open={isDetailsOpen}
        isDesktop={isDesktop}
        member={detailMember}
        payments={detailPayments}
        paymentsLoading={detailPaymentsLoading}
        onOpenChange={handleDetailsOpenChange}
        onEdit={handleOpenEdit}
        onRecordPayment={handleRecordPayment}
        onSendReminder={handleSendReminder}
        onChangeStatus={handleDetailStatusChange}
        onRequestDelete={handleRequestDelete}
        onRefreshPayments={refreshDetailPayments}
        isUpdatingStatus={isDetailStatusUpdating}
        isDeleting={isDetailDeleting}
      />

      <MemberDeleteDialog
        open={isDeleteDialogOpen}
        member={memberPendingDelete}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isPending={deleteMemberMutation.isPending}
      />
    </div>
  )

}

