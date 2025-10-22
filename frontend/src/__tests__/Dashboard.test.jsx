import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock hooks and modules used by Dashboard
vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({
    data: {
      widgets: {
        active_members: 5,
        inactive_members: 1,
        suspended_members: 0,
        due_today: 2,
        overdue: 1,
        overdue_inactive: 0,
      },
      alerts: { due_today: [], overdue: [] },
      recentActivity: [],
      quickStats: {},
    },
    loading: false,
    error: null,
    refresh: () => {},
    isFetching: false,
  }),
}))

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => ({ business: { currency: 'USD' } }),
}))

vi.mock('@/hooks/use-toast', () => {
  // store the mock on globalThis so the test can access it after hoisting
  globalThis.__toastMock = globalThis.__toastMock || vi.fn()
  return { useToast: () => ({ toast: globalThis.__toastMock }) }
})

vi.mock('@/lib/commandBus', () => {
  globalThis.__emitCommandMock = globalThis.__emitCommandMock || vi.fn()
  return { emitCommand: (...args) => globalThis.__emitCommandMock(...args) }
})

import Dashboard from '@/pages/Dashboard'
import { MemoryRouter } from 'react-router-dom'

describe('Dashboard', () => {
  beforeEach(() => {
    globalThis.__toastMock && globalThis.__toastMock.mockClear()
    globalThis.__emitCommandMock && globalThis.__emitCommandMock.mockClear()
  })

  it('renders widget labels and shows quick action toast when record payment clicked', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

  // widget labels from the page (use getAllByText to avoid duplicate label nodes)
  const activeLabels = screen.getAllByText(/Active Members/i)
  expect(activeLabels.length).toBeGreaterThan(0)
  const overdueLabels = screen.getAllByText(/Overdue Payments/i)
  expect(overdueLabels.length).toBeGreaterThan(0)

    // click the Record Payment quick action button
    const recordBtn = screen.getByRole('button', { name: /Record Payment/i })
    fireEvent.click(recordBtn)

    // toast should be called with the configured message
    expect(globalThis.__toastMock).toHaveBeenCalled()
  })
})
