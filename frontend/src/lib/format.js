let settings = { locale: 'en-US', currency: 'USD' }
let moneyFormat = new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency })

export function configureFormat({ locale, currency }) {
  if (locale === settings.locale && currency === settings.currency) return
  settings = { locale, currency }
  moneyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency })
}

export const num = (value) => Number(value ?? 0).toLocaleString(settings.locale)

export const money = (value) => (value === null || value === undefined ? '—' : moneyFormat.format(Number(value)))

export function date(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const d = typeof value === 'string' && value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return d.toLocaleDateString(settings.locale, opts)
}

export function month(key) {
  return date(`${key}-01`, { month: 'short', year: '2-digit' })
}

export function relativeDays(value) {
  if (!value) return null
  const days = Math.round((new Date(`${value}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)
  return new Intl.RelativeTimeFormat(settings.locale, { numeric: 'auto' }).format(days, 'day')
}

export const today = () => new Date().toLocaleDateString('sv-SE')

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
