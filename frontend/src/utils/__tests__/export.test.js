import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toCsv, downloadCsv } from '../export'

describe('export util', () => {
  beforeEach(() => {
    // reset any URL mocks
    global.URL.createObjectURL = global.URL.createObjectURL || undefined
    global.URL.revokeObjectURL = global.URL.revokeObjectURL || undefined
  })

  it('converts rows and headers to CSV string correctly', () => {
    const rows = [{ name: 'Alice', age: 30 }, { name: 'Bob, Jr', age: 25 }]
    const headers = [{ key: 'name' }, { key: 'age', label: 'Age' }]
    const csv = toCsv(rows, headers)
    expect(csv).toContain('name,Age')
    expect(csv).toContain('Alice')
    expect(csv).toContain('"Bob, Jr"')
  })

  it('creates a blob URL and revokes it when downloading', () => {
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    const mockCreate = vi.fn(() => 'blob:fake')
    const mockRevoke = vi.fn()
    URL.createObjectURL = mockCreate
    URL.revokeObjectURL = mockRevoke

    // spy on link click
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    downloadCsv('test.csv', [{ a: 1 }], [{ key: 'a' }], { bom: false })

    expect(mockCreate).toHaveBeenCalled()
    expect(mockRevoke).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()

    // restore
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
import { toCsv } from '../export'

describe('export utils', () => {
  it('creates CSV with headers and escapes values', () => {
    const rows = [
      { name: 'Alice', amount: 10, note: 'Hello, "World"' },
      { name: 'Bob', amount: 20, note: 'Line\nBreak' },
    ]
    const headers = [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount' },
      { key: 'note', label: 'Note' },
    ]

    const csv = toCsv(rows, headers)
    const expected = [
      'Name,Amount,Note',
      'Alice,10,"Hello, ""World"""',
      'Bob,20,"Line\nBreak"',
    ].join('\n')
    expect(csv).toBe(expected)
  })
})
