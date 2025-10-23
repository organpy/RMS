import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/hooks/use-toast', () => {
  globalThis.__toastMock = globalThis.__toastMock || vi.fn()
  return { useToast: () => ({ toast: globalThis.__toastMock }) }
})

// Mock member hooks
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

describe('Members page', () => {
  beforeEach(() => {
    globalThis.__toastMock && globalThis.__toastMock.mockClear()
    if (typeof window.matchMedia !== 'function') {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })
    }
  })

  it('renders and can export all members (empty)', async () => {
  vi.resetModules()
  // ensure toast mock is available for the re-mocked module
  globalThis.__toastMock = globalThis.__toastMock || vi.fn()
  vi.doMock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: globalThis.__toastMock }) }))
    // Paths are relative to the Members module (src/pages); from this test file the correct relative
    // path to hooks in src/hooks is '../../hooks/...'
    vi.doMock('../../hooks/useMemberFilters', () => ({
      useMemberFilters: () => ({ classOptions: [], groupOptions: [], loading: false }),
    }))
    vi.doMock('../../hooks/useMembers', () => ({
      useMembers: () => ({ members: [], meta: { total: 0 }, loading: false, refresh: () => {}, isFetching: false, queryKey: ['members'] }),
      createMember: vi.fn().mockResolvedValue({}),
      updateMember: vi.fn().mockResolvedValue({}),
      updateMemberStatus: vi.fn().mockResolvedValue({}),
      deleteMember: vi.fn().mockResolvedValue({}),
    }))
    vi.doMock('@/utils/exporters/members', () => ({ exportAllMembersCsv: async () => ({ count: 0 }) }))
    // Mock DataTable so toolbarContent (MemberFilters) is rendered predictably.
    // Members.jsx imports DataTable via a relative path ('../components/data/DataTable'),
    // so from this test file the correct mock path is '../../components/data/DataTable'.
    vi.doMock('../../components/data/DataTable', () => ({
      __esModule: true,
      default: (props) => {
        const { toolbarContent } = props || {}
        return <div data-testid="datatable-mock">{toolbarContent}</div>
      },
    }))

    const { default: Members } = await import('../Members')

    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Members />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // MemberFilters renders 'Export all CSV' button when mounted, ensure it's present
    const exportBtn = await screen.findByRole('button', { name: /Export all CSV|Export all/i })
    fireEvent.click(exportBtn)

    await waitFor(() => expect(globalThis.__toastMock).toHaveBeenCalled())
  })
})
