import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemberTable } from '@/components/members/MemberTable'
import DataTable from '@/components/data/DataTable'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// Mock DataTable to expose the Export CSV button and simulate export behavior
vi.mock('@/components/data/DataTable', () => {
  return {
    __esModule: true,
    default: (props) => {
      const { data = [], toolbarContent } = props
      return (
        <div>
          <div data-testid="toolbar">{toolbarContent}</div>
          <button
            type="button"
            onClick={() => props && props.onExport?.()}
            disabled={!(data && data.length)}
          >
            Export CSV
          </button>
          <table>
            <tbody>
              {(data || []).map((row) => (
                <tr key={row.id} data-testid="row">
                  <td>{row.first_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
  }
})

function Wrapper({ children }) {
  const qc = new QueryClient()
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MemberTable', () => {
  test('shows bulk actions bar when rows are selected and displays summary', async () => {
    const members = [
      { id: 'm1', first_name: 'Alice', last_name: 'A', email: 'a@example.com', status: 'ACTIVE', membership_plan: 'Basic' },
      { id: 'm2', first_name: 'Bob', last_name: 'B', email: 'b@example.com', status: 'SUSPENDED', membership_plan: 'Pro' },
    ]

    let selected = []
    const setSelected = (fn) => {
      if (typeof fn === 'function') selected = fn(selected)
      else selected = fn
    }

    render(
      <Wrapper>
        <MemberTable
          members={members}
          searchTerm=""
          loading={false}
          error={null}
          onRetry={() => {}}
          meta={{ total: 2, limit: 10 }}
          isFetching={false}
          page={1}
          pageSize={10}
          onPageChange={() => {}}
          selectedMemberIds={selected}
          setSelectedMemberIds={setSelected}
          onViewMember={() => {}}
          onEditMember={() => {}}
          onChangeStatus={() => {}}
          onRecordPayment={() => {}}
          onSendReminder={() => {}}
          onBulkChangeStatus={() => {}}
          onBulkSendReminder={() => {}}
          isBulkUpdating={false}
          isBulkNotifying={false}
        />
      </Wrapper>,
    )

    // initially no bulk actions
    expect(screen.queryByText(/selected/)).toBeNull()

    // select the first member by calling the internal setSelected (simulate checkbox)
    // toggle by invoking the setSelected with adding the first id
    setSelected((prev) => [...prev, 'm1'])

    // re-render with updated selected state
    render(
      <Wrapper>
        <MemberTable
          members={members}
          searchTerm=""
          loading={false}
          error={null}
          onRetry={() => {}}
          meta={{ total: 2, limit: 10 }}
          isFetching={false}
          page={1}
          pageSize={10}
          onPageChange={() => {}}
          selectedMemberIds={selected}
          setSelectedMemberIds={setSelected}
          onViewMember={() => {}}
          onEditMember={() => {}}
          onChangeStatus={() => {}}
          onRecordPayment={() => {}}
          onSendReminder={() => {}}
          onBulkChangeStatus={() => {}}
          onBulkSendReminder={() => {}}
          isBulkUpdating={false}
          isBulkNotifying={false}
        />
      </Wrapper>,
    )

    expect(screen.getByText(/1 member/)).toBeInTheDocument()
    // summary should contain status breakdown
    expect(screen.getByText(/Status breakdown:/)).toBeInTheDocument()
  })

  test('DataTable Export CSV button disabled when no rows and enabled when rows exist', () => {
    const members = []
    const setSelected = vi.fn()

    const { rerender } = render(
      <Wrapper>
        <MemberTable
          members={members}
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
          setSelectedMemberIds={setSelected}
          onViewMember={() => {}}
          onEditMember={() => {}}
          onChangeStatus={() => {}}
          onRecordPayment={() => {}}
          onSendReminder={() => {}}
          onBulkChangeStatus={() => {}}
          onBulkSendReminder={() => {}}
          isBulkUpdating={false}
          isBulkNotifying={false}
        />
      </Wrapper>,
    )

    // Export button should be present but disabled
    const exportBtn = screen.getByText('Export CSV')
    expect(exportBtn).toBeDisabled()

    // now render with rows
    const rows = [
      { id: 'r1', first_name: 'Cathy', last_name: 'C', email: 'c@example.com' },
    ]

    rerender(
      <Wrapper>
        <MemberTable
          members={rows}
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
          setSelectedMemberIds={setSelected}
          onViewMember={() => {}}
          onEditMember={() => {}}
          onChangeStatus={() => {}}
          onRecordPayment={() => {}}
          onSendReminder={() => {}}
          onBulkChangeStatus={() => {}}
          onBulkSendReminder={() => {}}
          isBulkUpdating={false}
          isBulkNotifying={false}
        />
      </Wrapper>,
    )

    const exportBtnEnabled = screen.getByText('Export CSV')
    expect(exportBtnEnabled).not.toBeDisabled()
  })
})

export {}
