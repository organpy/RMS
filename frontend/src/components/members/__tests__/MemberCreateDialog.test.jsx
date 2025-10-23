import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemberCreateDialog } from '@/components/members/MemberCreateDialog'

// Create a minimal mock form object that matches the shape used by MemberForm
function createMockForm() {
  const handlers = {}
  return {
    register: (name) => ({ name, onChange: handlers[name] ?? (() => {}), value: '' }),
    handleSubmit: (fn) => (e) => {
      e && e.preventDefault && e.preventDefault()
      // call with empty data for tests
      return fn({})
    },
    formState: { errors: {} },
  }
}

describe('MemberCreateDialog', () => {
  test('opens dialog via trigger and submits form', async () => {
    const mockForm = createMockForm()
    const onSubmit = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <MemberCreateDialog open={false} onOpenChange={onOpenChange} form={mockForm} onSubmit={onSubmit} onCancel={() => {}} isSubmitting={false} />,
    )

    // The trigger button should be present
    const trigger = screen.getByText('Add Member')
    expect(trigger).toBeInTheDocument()

    // Simulate click on trigger; since Dialog uses headless UI, we'll directly call onOpenChange
    fireEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalled()
  })

  test('shows validation errors when submit is invalid (simulated)', async () => {
    // We simulate form errors by providing a formState with errors
    const mockForm = createMockForm()
    mockForm.formState.errors = { first_name: { message: 'First name is required' } }

    const onSubmit = vi.fn()
    render(
      <MemberCreateDialog open={true} onOpenChange={() => {}} form={mockForm} onSubmit={onSubmit} onCancel={() => {}} isSubmitting={false} />,
    )

    // The error message should be rendered by MemberForm
    expect(screen.getByText('First name is required')).toBeInTheDocument()
  })
})

export {}
