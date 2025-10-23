import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Table from '../Table'

describe('Table component', () => {
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
  ]

  it('renders header labels', () => {
    render(<Table columns={columns} data={[]} />)
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('renders rows when data provided', () => {
    const data = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
    render(<Table columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<Table columns={columns} data={[]} emptyState={{ title: 'No rows', description: 'Nothing here' }} />)
    expect(screen.getByText('No rows')).toBeInTheDocument()
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})
