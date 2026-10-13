import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from './pagination'
import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('labels member status', () => {
    render(<StatusBadge status="overdue" />)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('hides on a single page and pages forward', async () => {
    const { container, rerender } = render(<Pagination page={1} size={25} total={10} onPage={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    const onPage = vi.fn()
    rerender(<Pagination page={1} size={25} total={60} onPage={onPage} />)
    expect(screen.getByText('1–25 of 60')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Next page'))
    expect(onPage).toHaveBeenCalledWith(2)
  })
})
