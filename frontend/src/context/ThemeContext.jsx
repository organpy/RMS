import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const COLOR_MODE_STORAGE_KEY = 'rms:color-mode'

const DEFAULT_THEME = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
}

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveColorMode(mode) {
  if (mode === 'dark' || mode === 'light') return mode
  return getSystemPrefersDark() ? 'dark' : 'light'
}

function applyColorMode(mode) {
  const root = document.documentElement
  const resolved = resolveColorMode(mode)
  root.classList.toggle('dark', resolved === 'dark')
}

function hexToHslTuple(hex) {
  if (!hex) return null
  let value = hex.replace('#', '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  }
  if (value.length !== 6) return null

  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
      default:
        h = 0
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslTupleToString(tuple) {
  if (!tuple) return null
  const { h, s, l } = tuple
  return `${h} ${s}% ${l}%`
}

function foregroundForLightness(lightness) {
  return lightness > 60 ? '222 47% 11%' : '210 40% 98%'
}

function applyTheme({ primaryColor, secondaryColor }) {
  const root = document.documentElement

  const primary = hexToHslTuple(primaryColor)
  const secondary = hexToHslTuple(secondaryColor)

  if (primary) {
    const primaryString = hslTupleToString(primary)
    root.style.setProperty('--primary', primaryString)
    root.style.setProperty('--ring', primaryString)
    root.style.setProperty('--primary-foreground', foregroundForLightness(primary.l))
  }

  if (secondary) {
    root.style.setProperty('--secondary', hslTupleToString(secondary))
    root.style.setProperty('--secondary-foreground', foregroundForLightness(secondary.l))
  }

  root.style.setProperty('--color-primary', primaryColor)
  root.style.setProperty('--color-secondary', secondaryColor)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [colorMode, setColorMode] = useState('system')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setColorMode(saved)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode)
  }, [colorMode])

  useEffect(() => {
    if (typeof window === 'undefined') return

    applyColorMode(colorMode)

    if (colorMode !== 'system' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyColorMode('system')

    if (media.addEventListener) {
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    }

    media.addListener(handler)
    return () => media.removeListener(handler)
  }, [colorMode])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const resolvedColorMode = useMemo(() => resolveColorMode(colorMode), [colorMode])

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const resolved = resolveColorMode(prev)
      return resolved === 'dark' ? 'light' : 'dark'
    })
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resetTheme: () => setTheme(DEFAULT_THEME),
      colorMode,
      resolvedColorMode,
      setColorMode,
      toggleColorMode,
    }),
    [colorMode, resolvedColorMode, theme, toggleColorMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
