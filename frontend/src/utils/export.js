// Lightweight CSV export helpers seeded for Phase 9

function escapeCsvValue(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

// headers: Array<{ key: string, label?: string, transform?: (row) => any }>
export function toCsv(rows, headers) {
  const headerRow = headers.map((h) => escapeCsvValue(h.label ?? h.key)).join(',')
  const body = rows
    .map((row) =>
      headers
        .map((h) => {
          const raw = typeof h.transform === 'function' ? h.transform(row) : row?.[h.key]
          return escapeCsvValue(raw)
        })
        .join(','),
    )
    .join('\n')
  return `${headerRow}\n${body}`
}

export function downloadCsv(filename, rows, headers, { bom = true } = {}) {
  const csv = toCsv(rows, headers)
  const content = bom ? `\uFEFF${csv}` : csv
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default {
  toCsv,
  downloadCsv,
}
