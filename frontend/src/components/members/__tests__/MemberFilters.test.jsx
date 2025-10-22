import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemberFilters } from '@/components/members/MemberFilters'

describe('MemberFilters', () => {
  const statusOptions = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'SUSPENDED', label: 'Suspended' },
  ]

  const classOptions = [
    { value: 'class1', label: 'Class 1' },
    { value: 'class2', label: 'Class 2' },
  ]

  const groupOptions = [
    { value: 'g1', displayLabel: 'Group 1' },
    { value: 'g2', displayLabel: 'Group 2' },
  ]

  test('calls onSearchChange when typing in search input', () => {
    const onSearchChange = vi.fn()
    render(
      <MemberFilters
        searchTerm=""
        onSearchChange={onSearchChange}
        status="ALL"
        statusOptions={statusOptions}
        onStatusChange={() => {}}
        classFilter="ALL"
        classOptions={classOptions}
        onClassChange={() => {}}
        groupFilter="ALL"
        groupSelectOptions={groupOptions}
        groupSelectPlaceholder="All groups"
        onGroupChange={() => {}}
        filtersLoading={false}
        hasGroupOptions={true}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    )

    const input = screen.getByPlaceholderText('Search members')
    fireEvent.change(input, { target: { value: 'alice' } })
    expect(onSearchChange).toHaveBeenCalledWith('alice')
  })

  test('status, class and group selects call handlers and export button state works', () => {
    const onStatusChange = vi.fn()
    const onClassChange = vi.fn()
    const onGroupChange = vi.fn()
    const onRefresh = vi.fn()
    const onExportAll = vi.fn()

    render(
      <MemberFilters
        searchTerm=""
        onSearchChange={() => {}}
        status="ALL"
        statusOptions={statusOptions}
        onStatusChange={onStatusChange}
        classFilter="ALL"
        classOptions={classOptions}
        onClassChange={onClassChange}
        groupFilter="ALL"
        groupSelectOptions={groupOptions}
        groupSelectPlaceholder="All groups"
        onGroupChange={onGroupChange}
        filtersLoading={false}
        hasGroupOptions={true}
        onRefresh={onRefresh}
        isRefreshing={false}
        onExportAll={onExportAll}
        isExporting={false}
      />,
    )

    const statusSelect = screen.getByDisplayValue('All')
    fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } })
    expect(onStatusChange).toHaveBeenCalledWith('ACTIVE')

    const classSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(classSelect, { target: { value: 'class1' } })
    expect(onClassChange).toHaveBeenCalledWith('class1')

    const groupSelect = screen.getAllByRole('combobox')[2]
    fireEvent.change(groupSelect, { target: { value: 'g1' } })
    expect(onGroupChange).toHaveBeenCalledWith('g1')

    const refreshBtn = screen.getByText('Refresh')
    fireEvent.click(refreshBtn)
    expect(onRefresh).toHaveBeenCalled()

    const exportBtn = screen.getByText('Export all CSV')
    fireEvent.click(exportBtn)
    expect(onExportAll).toHaveBeenCalled()
  })

  test('disables class/group selects when filtersLoading or no group options', () => {
    const { rerender } = render(
      <MemberFilters
        searchTerm=""
        onSearchChange={() => {}}
        status="ALL"
        statusOptions={statusOptions}
        onStatusChange={() => {}}
        classFilter="ALL"
        classOptions={classOptions}
        onClassChange={() => {}}
        groupFilter="ALL"
        groupSelectOptions={[]}
        groupSelectPlaceholder="All groups"
        onGroupChange={() => {}}
        filtersLoading={true}
        hasGroupOptions={false}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    )

    const selects = screen.getAllByRole('combobox')
    // class select is disabled due to filtersLoading
    expect(selects[1]).toBeDisabled()

    // rerender with filtersLoading false but no group options; group select should be disabled
    rerender(
      <MemberFilters
        searchTerm=""
        onSearchChange={() => {}}
        status="ALL"
        statusOptions={statusOptions}
        onStatusChange={() => {}}
        classFilter="ALL"
        classOptions={classOptions}
        onClassChange={() => {}}
        groupFilter="ALL"
        groupSelectOptions={[]}
        groupSelectPlaceholder="All groups"
        onGroupChange={() => {}}
        filtersLoading={false}
        hasGroupOptions={false}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    )

    const selects2 = screen.getAllByRole('combobox')
    expect(selects2[2]).toBeDisabled()
  })
})

export {}
