import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DataTable from '@/components/data/DataTable'

const columns = [
  {
    id: 'name',
    header: 'Name',
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    meta: { exportValue: (r) => `${r.first_name} ${r.last_name}` },
  },
]

function makeRows(n = 1) {
  return Array.from({ length: n }).map((_, i) => ({ id: i + 1, first_name: `F${i + 1}`, last_name: `L${i + 1}` }))
}

describe('DataTable export button', () => {
  let originalCreateObjectURL
  let originalRevokeObjectURL

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    // mock appendChild and removeChild interactions indirectly via DOM
    vi.spyOn(document.body, 'appendChild')
    vi.spyOn(document.body, 'removeChild')
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    document.body.appendChild.mockRestore()
    document.body.removeChild.mockRestore()
  })

  it('disables Export CSV when there are no rows', () => {
    render(<DataTable columns={columns} data={[]} page={1} pageSize={10} totalCount={0} />)
    const exportButton = screen.getByRole('button', { name: /Export CSV/i })
    expect(exportButton).toBeDisabled()
  })

  it('enables Export CSV and triggers download when rows present', () => {
    render(<DataTable columns={columns} data={makeRows(2)} page={1} pageSize={10} totalCount={2} />)
    const exportButton = screen.getByRole('button', { name: /Export CSV/i })
    expect(exportButton).not.toBeDisabled()

    fireEvent.click(exportButton)

    // createObjectURL should be called to build blob URL
    expect(URL.createObjectURL).toHaveBeenCalled()
    // appendChild should have been called to attach the link
    expect(document.body.appendChild).toHaveBeenCalled()
    expect(document.body.removeChild).toHaveBeenCalled()
  })
})
