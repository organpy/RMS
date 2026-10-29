/** Date-range presets for reports, as [start, end] ISO dates in local time. */
const iso = (d) => d.toLocaleDateString('sv-SE')

export const PRESETS = [
  ['this-month', 'This month'],
  ['last-month', 'Last month'],
  ['3', 'Last 3 months'],
  ['6', 'Last 6 months'],
  ['12', 'Last 12 months'],
  ['custom', 'Custom range'],
]

export function presetRange(key, now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (key === 'this-month') return [iso(new Date(y, m, 1)), iso(now)]
  if (key === 'last-month') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
  return [iso(new Date(y, m - (Number(key) - 1), 1)), iso(now)]
}

/** Relative change versus a previous value, or null when there is nothing to compare with. */
export const percentChange = (current, previous) => (Number(previous) ? (Number(current) - Number(previous)) / Math.abs(Number(previous)) : null)
