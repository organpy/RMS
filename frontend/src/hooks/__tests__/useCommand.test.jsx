import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock only consumePendingCommand; we'll dispatch window events directly
vi.mock('@/lib/commandBus', () => ({
  consumePendingCommand: vi.fn(),
}))

import { useCommand } from '../useCommand'
import { consumePendingCommand } from '@/lib/commandBus'

function CommandConsumer({ name, handler }) {
  useCommand(name, handler)
  return null
}

describe('useCommand', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('calls handler when window app:command dispatched', () => {
    const handler = vi.fn()
    render(<CommandConsumer name="sayHello" handler={handler} />)

    const event = new CustomEvent('app:command', { detail: { name: 'sayHello', detail: { who: 'me' } } })
    window.dispatchEvent(event)

    expect(handler).toHaveBeenCalledWith({ who: 'me' }, expect.any(Object))
  })

  it('consumes a persisted pending command on mount', () => {
    const handler = vi.fn()
    const payload = {
      name: 'members.filterStatus',
      detail: { status: 'SUSPENDED', message: 'Showing suspended members.' },
      issuedAt: Date.now(),
    }

    sessionStorage.setItem('registration-management:pending-command', JSON.stringify(payload))
    consumePendingCommand.mockImplementation(() => {
      // mimic real implementation which removes the stored item
      const raw = sessionStorage.getItem('registration-management:pending-command')
      sessionStorage.removeItem('registration-management:pending-command')
      return raw ? JSON.parse(raw) : null
    })

    render(<CommandConsumer name="members.filterStatus" handler={handler} />)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(payload.detail, payload)
    expect(sessionStorage.getItem('registration-management:pending-command')).toBeNull()
  })
})
