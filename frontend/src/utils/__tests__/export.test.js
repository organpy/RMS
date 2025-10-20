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
