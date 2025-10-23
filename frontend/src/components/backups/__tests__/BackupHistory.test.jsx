import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/hooks/use-toast', () => {
  globalThis.__toastMock = globalThis.__toastMock || vi.fn()
  return { useToast: () => ({ toast: globalThis.__toastMock }) }
})

// Mock api helpers used in component
vi.mock('../../../services/api', () => ({
  get: async (path) => {
    if (path === '/api/backups') return [{ id: 1, path: 'backups/backup1.zip', size: 1234, status: 'READY', created_at: '2025-10-22T00:00:00Z' }]
    return []
  },
  getFile: async (path) => {
    // return a Blob-like object
    return new Blob(['ZIPDATA'], { type: 'application/zip' })
  },
  del: async (path) => ({ detail: 'deleted' }),
  post: async (path, form) => ({ detail: 'restore-started' }),
}))

import BackupHistory from '../BackupHistory'

describe('BackupHistory', () => {
  beforeEach(() => {
    globalThis.__toastMock && globalThis.__toastMock.mockClear()
    // mock URL.createObjectURL/revoke
    global.URL.createObjectURL = vi.fn(() => 'blob:url')
    global.URL.revokeObjectURL = vi.fn()
    // mock confirm dialog for delete
    global.confirm = vi.fn(() => true)
  })

  it('renders backup list and can download a backup', async () => {
    render(<BackupHistory />)

    // wait for the timestamp cell that indicates the row is present
    await waitFor(() => expect(screen.getByText('2025-10-22T00:00:00Z')).toBeInTheDocument())

    const downloadBtn = screen.getByRole('button', { name: /Download/i })
    fireEvent.click(downloadBtn)

    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled())
    expect(globalThis.__toastMock).toHaveBeenCalled()
  })

  it('can delete a backup', async () => {
    render(<BackupHistory />)

    await waitFor(() => expect(screen.getByText('2025-10-22T00:00:00Z')).toBeInTheDocument())

    const deleteBtn = screen.getByRole('button', { name: /Delete/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => expect(globalThis.__toastMock).toHaveBeenCalled())
  })
})
