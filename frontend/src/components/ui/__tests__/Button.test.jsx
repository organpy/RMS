import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Button from '../Button'

describe('Button component', () => {
  it('renders as a button with default props', () => {
    render(<Button>Click</Button>)
    const btn = screen.getByRole('button', { name: /click/i })
    expect(btn).toBeInTheDocument()
    // default type should be 'button'
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('renders as an anchor when `as` is provided', () => {
    render(
      <Button as="a" href="/test">
        Link
      </Button>,
    )
    const link = screen.getByRole('link', { name: /link/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('applies variant and size classes', () => {
    render(
      <Button variant="ghost" size="sm" className="extra">
        Small
      </Button>,
    )
    const btn = screen.getByRole('button', { name: /small/i })
    expect(btn.className).toContain('extra')
    // ghost variant should include 'bg-transparent'
    expect(btn.className).toContain('bg-transparent')
    // small size should include 'h-9'
    expect(btn.className).toContain('h-9')
  })
})
