import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { act } from 'react'
import { useCommand } from '../useCommand'
import { emitCommand } from '@/lib/commandBus'

function CommandConsumer({ name, handler }) {
  useCommand(name, handler)
  return null
}

describe('useCommand', () => {
  it('invokes the handler when a matching command is emitted', () => {
    const handler = vi.fn()

    render(<CommandConsumer name="members.openCreate" handler={handler} />)

    act(() => {
      emitCommand('members.openCreate', { source: 'test-suite' })
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      { source: 'test-suite' },
      expect.objectContaining({ name: 'members.openCreate' }),
    )
  })

  it('consumes a persisted pending command on mount', () => {
    const handler = vi.fn()
    const payload = {
      name: 'members.filterStatus',
      detail: { status: 'SUSPENDED', message: 'Showing suspended members.' },
      issuedAt: Date.now(),
    }

    sessionStorage.setItem('registration-management:pending-command', JSON.stringify(payload))

    render(<CommandConsumer name="members.filterStatus" handler={handler} />)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(payload.detail, payload)
    expect(sessionStorage.getItem('registration-management:pending-command')).toBeNull()
  })
})
