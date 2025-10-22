import { render, screen } from '@testing-library/react'

import React from 'react'

function Hello() {
  return <div>Hello Frontend</div>
}

test('renders hello text', () => {
  render(<Hello />)
  expect(screen.getByText('Hello Frontend')).toBeInTheDocument()
})
