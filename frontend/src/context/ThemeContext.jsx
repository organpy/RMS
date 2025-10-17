import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const DEFAULT_THEME = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
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

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resetTheme: () => setTheme(DEFAULT_THEME),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
