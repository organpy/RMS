export const PRESETS = [
  [7, 'Weekly'],
  [30, 'Monthly'],
  [90, 'Quarterly'],
  [180, 'Semester'],
  [365, 'Yearly'],
]

export const intervalLabel = (days) => PRESETS.find(([d]) => d === days)?.[1] ?? `Every ${days} days`
