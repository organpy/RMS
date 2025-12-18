import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
// Mock useBusiness to avoid needing BusinessProvider in this smoke test
vi.mock('@/context/BusinessContext', () => ({
  useBusiness: () => ({
    business: { currency: 'USD', name: 'Test Studio' },
    backupConfig: {},
    backupStatus: { loading: false, error: null },
    loadBackupConfig: async () => ({}),
    status: { loading: false, error: null },
    refresh: () => {},
    updateBackupSchedule: async () => ({}),
  }),
}))
// Mock ThemeContext to avoid needing ThemeProvider
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { primaryColor: '#2563eb', secondaryColor: '#1e293b' },
    setTheme: () => {},
    resetTheme: () => {},
    colorMode: 'light',
    resolvedColorMode: 'light',
    toggleColorMode: () => {},
    setColorMode: () => {},
  }),
}))
import Settings from '@/pages/Settings'

test('Settings page renders basic sections', () => {
  render(<Settings />)
  // Basic smoke assertions — use role queries to avoid ambiguous matches
  expect(screen.getByRole('heading', { name: /Backups/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Download manual backup/i })).toBeInTheDocument()
})
