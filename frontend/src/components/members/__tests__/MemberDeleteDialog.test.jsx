import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemberDeleteDialog } from '@/components/members/MemberDeleteDialog'

describe('MemberDeleteDialog', () => {
  test('renders member name in description and calls handlers', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const member = { first_name: 'John', last_name: 'Doe' }

    render(<MemberDeleteDialog open={true} member={member} onCancel={onCancel} onConfirm={onConfirm} isPending={false} />)

    expect(screen.getByText(/Remove member\?/)).toBeInTheDocument()
    expect(screen.getByText(/This will archive John Doe/)).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    const removeBtn = screen.getByRole('button', { name: /Remove member/i })

    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalled()

    fireEvent.click(removeBtn)
    expect(onConfirm).toHaveBeenCalled()
  })

  test('disables buttons and shows Removing… when pending', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const member = { first_name: 'Jane', last_name: 'Smith' }

    render(<MemberDeleteDialog open={true} member={member} onCancel={onCancel} onConfirm={onConfirm} isPending={true} />)

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    const removingBtn = screen.getByRole('button', { name: /Removing…/i })

    expect(cancelBtn).toBeDisabled()
    expect(removingBtn).toBeDisabled()
  })
})

export {}
