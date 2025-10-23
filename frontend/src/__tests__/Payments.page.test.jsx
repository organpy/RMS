import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

describe('Payments page toolbar', () => {
  it('shows export all disabled when there are no payments', async () => {
    vi.resetModules()
    // mock useBusiness and usePayments for this test
    vi.doMock('../context/BusinessContext', () => ({ useBusiness: () => ({ business: { currency: 'USD' } }) }))
    vi.doMock('../hooks/usePayments', () => ({
      usePayments: () => ({
        data: { payments: [], summary: {} },
        loading: false,
        error: null,
        refresh: () => {},
        isFetching: false,
      }),
    }))

    const { default: Payments } = await import('../pages/Payments')

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Payments />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const exportButtons = screen.getAllByRole('button', { name: /Export all CSV/i })
    expect(exportButtons.length).toBeGreaterThan(0)
    // at least one toolbar export should be disabled when no payments
    expect(exportButtons.some((b) => b.disabled)).toBe(true)
  })

  it('enables export when payments exist', async () => {
    vi.resetModules()
    // mock useBusiness and usePayments for this test
    vi.doMock('../context/BusinessContext', () => ({ useBusiness: () => ({ business: { currency: 'USD' } }) }))
    vi.doMock('../hooks/usePayments', () => ({
      usePayments: () => ({
        data: { payments: [{ id: 1, amount: 10 }], summary: {} },
        loading: false,
        error: null,
        refresh: () => {},
        isFetching: false,
      }),
    }))

    const { default: Payments } = await import('../pages/Payments')

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Payments />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const exportButtons = screen.getAllByRole('button', { name: /Export all CSV/i })
    expect(exportButtons.length).toBeGreaterThan(0)
    // ensure at least one Export all CSV is enabled when payments exist
    expect(exportButtons.some((b) => !b.disabled)).toBe(true)
  })
})
