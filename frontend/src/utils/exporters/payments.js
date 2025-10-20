import { downloadCsv } from '@/utils/export'
import { get } from '@/services/api'

const PAYMENTS_ENDPOINT = '/api/payments'

function buildParams(filters) {
  const params = new URLSearchParams()
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value)
    }
  })
  return params.toString()
}

export function buildPaymentExportHeaders({ currency = 'USD' } = {}) {
  return [
    { key: 'member_name', label: 'Member' },
    { key: 'membership_plan', label: 'Plan' },
    {
      key: 'payment_date',
      label: 'Date',
      transform: (p) => {
        if (!p.payment_date) return ''
        const parsed = new Date(p.payment_date)
        return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString()
      },
    },
    {
      key: 'amount',
      label: `Amount (${currency})`,
      transform: (p) => {
        const value = Number(p.amount ?? 0)
        if (!Number.isFinite(value)) return ''
        try {
          return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
        } catch {
          return value.toFixed(2)
        }
      },
    },
    { key: 'status', label: 'Status' },
    { key: 'receipt_number', label: 'Receipt #' },
  ]
}

export async function exportPaymentsCsv(filters = {}, { filename = 'payments-export.csv', currency = 'USD' } = {}) {
  const params = buildParams(filters)
  const { payments = [] } = await get(`${PAYMENTS_ENDPOINT}${params ? `?${params}` : ''}`)
  const headers = buildPaymentExportHeaders({ currency })
  downloadCsv(filename, payments, headers)
  return { count: payments.length }
}

export default {
  exportPaymentsCsv,
  buildPaymentExportHeaders,
}
