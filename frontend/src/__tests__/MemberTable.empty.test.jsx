import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemberTable } from '../components/members/MemberTable'

test('shows empty state when no members', () => {
  render(
    <MemberTable
      members={[]}
      searchTerm=""
      loading={false}
      error={null}
      onRetry={() => {}}
      meta={{ total: 0, skip: 0, limit: 10 }}
      isFetching={false}
      page={0}
      pageSize={10}
      onPageChange={() => {}}
      selectedMemberIds={[]}
      setSelectedMemberIds={() => {}}
      onViewMember={() => {}}
      onEditMember={() => {}}
      onChangeStatus={() => {}}
      onRecordPayment={() => {}}
      onSendReminder={() => {}}
      onBulkChangeStatus={() => {}}
      onBulkSendReminder={() => {}}
    />,
  )

  expect(screen.getByText(/No members found/i)).toBeInTheDocument()
})
