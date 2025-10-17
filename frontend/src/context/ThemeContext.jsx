import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const DEFAULT_THEME = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
}

function applyTheme({ primaryColor, secondaryColor }) {
  const root = document.documentElement
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
