import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { RequireAuth } from './require-auth'

function renderAt(responses) {
  globalThis.fetch = vi.fn(async (input) => {
    const [status, body] = responses[new URL(input, 'http://x').pathname]
    return new Response(JSON.stringify(body), { status })
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/members']}>
        <Routes>
          <Route path="/setup" element={<p>setup</p>} />
          <Route path="/login" element={<p>login</p>} />
          <Route path="/members" element={<RequireAuth><p>secret</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('sends a fresh install to setup', async () => {
  renderAt({ '/api/auth/status': [200, { setup_required: true }], '/api/auth/me': [401, {}] })
  expect(await screen.findByText('setup')).toBeInTheDocument()
})

it('sends signed-out users to login', async () => {
  renderAt({ '/api/auth/status': [200, { setup_required: false }], '/api/auth/me': [401, {}] })
  expect(await screen.findByText('login')).toBeInTheDocument()
})

it('renders the page for signed-in staff', async () => {
  renderAt({ '/api/auth/status': [200, { setup_required: false }], '/api/auth/me': [200, { id: 1, name: 'A', role: 'admin' }] })
  expect(await screen.findByText('secret')).toBeInTheDocument()
})
