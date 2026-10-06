const KEY = 'rms-theme'

export const getMode = () => localStorage.getItem(KEY) ?? 'system'

export function applyMode(mode = getMode()) {
  localStorage.setItem(KEY, mode)
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  applyBrand(currentBrand)
}

let currentBrand = '#18181b'

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Use the organization colour as the single accent, keeping it legible in both modes. */
export function applyBrand(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return
  currentBrand = hex
  const dark = document.documentElement.classList.contains('dark')
  const lum = luminance(hex)
  const accent = dark && lum < 0.05 ? '#fafafa' : hex
  const root = document.documentElement.style
  root.setProperty('--accent', accent)
  root.setProperty('--accent-foreground', luminance(accent) > 0.45 ? '#09090b' : '#ffffff')
}
