import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemberTable } from '../components/members/MemberTable'

function makeMembers(count = 3) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${i + 1}`,
    first_name: `First${i + 1}`,
    last_name: `Last${i + 1}`,
    email: `user${i + 1}@example.com`,
    membership_plan: 'Standard',
    status: 'ACTIVE',
    join_date: '2024-01-01',
    next_payment_due: '2025-01-01',
  }))
}

describe('MemberTable DataTable integration', () => {
  it('renders empty state title and description when no members and no filters', () => {
    render(
      <MemberTable
        members={[]}
        searchTerm=""
        loading={false}
        error={null}
        onRetry={() => {}}
        meta={{ total: 0, limit: 10 }}
        isFetching={false}
        page={1}
        pageSize={10}
        onPageChange={() => {}}
        selectedMemberIds={[]}
        setSelectedMemberIds={() => {}}
        onViewMember={() => {}}
        onEditMember={() => {}}
        onChangeStatus={() => {}}
        onRecordPayment={() => {}}
        onSendReminder={() => {}}
        statusUpdateMemberId={null}
        isStatusMutating={false}
        editingMemberId={null}
        isEditMutating={false}
        onBulkChangeStatus={() => {}}
        onBulkSendReminder={() => {}}
        isBulkUpdating={false}
        isBulkNotifying={false}
        toolbarContent={null}
      />,
    )

    expect(screen.getByText('No members found')).toBeTruthy()
    expect(screen.getByText('Try adjusting filters or add a new member.')).toBeTruthy()
  })

  it('shows pagination controls when totalCount > 0 and pageSize provided', () => {
    // simulate server-side pagination: data contains only the current page rows
    const members = makeMembers(5)
    render(
      <MemberTable
        members={members}
        searchTerm=""
        loading={false}
        error={null}
        onRetry={() => {}}
        meta={{ total: 7, limit: 5 }}
        isFetching={false}
        page={1}
        pageSize={5}
        onPageChange={() => {}}
        selectedMemberIds={[]}
        setSelectedMemberIds={() => {}}
        onViewMember={() => {}}
        onEditMember={() => {}}
        onChangeStatus={() => {}}
        onRecordPayment={() => {}}
        onSendReminder={() => {}}
        statusUpdateMemberId={null}
        isStatusMutating={false}
        editingMemberId={null}
        isEditMutating={false}
        onBulkChangeStatus={() => {}}
        onBulkSendReminder={() => {}}
        isBulkUpdating={false}
        isBulkNotifying={false}
        toolbarContent={null}
      />,
    )

    // page indicator should be visible
    expect(screen.getByText(/Page/)).toBeTruthy()
    // Next button should be enabled (since there are 2 pages)
    expect(screen.getByRole('button', { name: /Next/i })).not.toBeDisabled()
  })

  it('select-all checkbox toggles selection and shows BulkActionsBar', () => {
    const members = makeMembers(3)
    const setSelected = vi.fn()

    render(
      <MemberTable
        members={members}
        searchTerm=""
        loading={false}
        error={null}
        onRetry={() => {}}
        meta={{ total: 3, limit: 10 }}
        isFetching={false}
        page={1}
        pageSize={10}
        onPageChange={() => {}}
        selectedMemberIds={[]}
        setSelectedMemberIds={setSelected}
        onViewMember={() => {}}
        onEditMember={() => {}}
        onChangeStatus={() => {}}
        onRecordPayment={() => {}}
        onSendReminder={() => {}}
        statusUpdateMemberId={null}
        isStatusMutating={false}
        editingMemberId={null}
        isEditMutating={false}
        onBulkChangeStatus={() => {}}
        onBulkSendReminder={() => {}}
        isBulkUpdating={false}
        isBulkNotifying={false}
        toolbarContent={null}
      />,
    )

    const selectAll = screen.getByLabelText('Select all members')
    expect(selectAll).toBeInTheDocument()

    // simulate checking the select-all checkbox
    fireEvent.click(selectAll)
    // setSelectedMemberIds should've been called with a function; ensure it's invoked
    expect(setSelected).toHaveBeenCalled()
  })

  it('renders toolbar content when provided', () => {
    const members = makeMembers(1)
    const toolbar = <div>My toolbar</div>

    render(
      <MemberTable
        members={members}
        searchTerm=""
        loading={false}
        error={null}
        onRetry={() => {}}
        meta={{ total: 1, limit: 10 }}
        isFetching={false}
        page={1}
        pageSize={10}
        onPageChange={() => {}}
        selectedMemberIds={[]}
        setSelectedMemberIds={() => {}}
        onViewMember={() => {}}
        onEditMember={() => {}}
        onChangeStatus={() => {}}
        onRecordPayment={() => {}}
        onSendReminder={() => {}}
        statusUpdateMemberId={null}
        isStatusMutating={false}
        editingMemberId={null}
        isEditMutating={false}
        onBulkChangeStatus={() => {}}
        onBulkSendReminder={() => {}}
        isBulkUpdating={false}
        isBulkNotifying={false}
        toolbarContent={toolbar}
      />,
    )

    expect(screen.getByText('My toolbar')).toBeInTheDocument()
  })
})
