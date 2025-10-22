import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemberTable } from '../components/members/MemberTable'

const sampleMembers = [
  { id: 1, first_name: 'Alice', last_name: 'A', email: 'alice@example.com', status: 'ACTIVE', membership_plan: 'Standard', join_date: '2025-01-01', next_payment_due: '2025-12-01' },
  { id: 2, first_name: 'Bob', last_name: 'B', email: 'bob@example.com', status: 'SUSPENDED', membership_plan: 'Premium', join_date: '2025-02-01', next_payment_due: '2025-11-01' },
]

test('renders members and toggles selection', () => {
  const setSelected = vi.fn()
  render(
    <MemberTable
      members={sampleMembers}
      searchTerm=""
      loading={false}
      error={null}
      onRetry={() => {}}
      meta={{ total: 2, skip: 0, limit: 10 }}
      isFetching={false}
      page={0}
      pageSize={10}
      onPageChange={() => {}}
      selectedMemberIds={[]}
      setSelectedMemberIds={setSelected}
      onViewMember={() => {}}
      onEditMember={() => {}}
      onChangeStatus={() => {}}
      onRecordPayment={() => {}}
      onSendReminder={() => {}}
      onBulkChangeStatus={() => {}}
      onBulkSendReminder={() => {}}
    />,
  )

  // Should render both names
  expect(screen.getByText(/Alice A/i)).toBeInTheDocument()
  expect(screen.getByText(/Bob B/i)).toBeInTheDocument()

  // Click select-all checkbox
  const selectAll = screen.getByLabelText(/Select all members/i)
  fireEvent.click(selectAll)

  // setSelectedMemberIds should be called
  expect(setSelected).toHaveBeenCalled()
})
