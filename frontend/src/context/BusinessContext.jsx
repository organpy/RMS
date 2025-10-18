import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { get, post, put } from '../services/api'

const BusinessContext = createContext(null)

const SETTINGS_ENDPOINT = '/api/settings'
const SETTINGS_LOGO_ENDPOINT = `${SETTINGS_ENDPOINT}/logo`
const SETTINGS_BACKUP_ENDPOINT = `${SETTINGS_ENDPOINT}/backup-config`

export function BusinessProvider({ children }) {
  const [business, setBusiness] = useState(null)
  const [backupConfig, setBackupConfig] = useState(null)
  const [status, setStatus] = useState({ loading: true, error: null })

  useEffect(() => {
    refresh()
  }, [])

  const refresh = async () => {
    setStatus((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await get(SETTINGS_ENDPOINT)
      setBusiness(data)
      if (data?.primary_color || data?.secondary_color) {
        document.documentElement.style.setProperty('--color-primary', data.primary_color ?? '#2563eb')
        document.documentElement.style.setProperty('--color-secondary', data.secondary_color ?? '#1e293b')
      }
      const backup = await get(SETTINGS_BACKUP_ENDPOINT)
      setBackupConfig(backup)
      setStatus({ loading: false, error: null })
    } catch (error) {
      setStatus({ loading: false, error })
    }
  }

  const updateBusiness = async (payload) => {
    const data = await put(SETTINGS_ENDPOINT, payload)
    setBusiness(data)
    if (payload.primary_color || payload.secondary_color) {
      document.documentElement.style.setProperty('--color-primary', data.primary_color ?? '#2563eb')
      document.documentElement.style.setProperty('--color-secondary', data.secondary_color ?? '#1e293b')
    }
    return data
  }

  const uploadLogo = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const data = await post(SETTINGS_LOGO_ENDPOINT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setBusiness(data)
    return data
  }

  const value = useMemo(
    () => ({
      business,
      backupConfig,
      status,
      refresh,
      updateBusiness,
      uploadLogo,
    }),
    [business, backupConfig, status],
  )

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusiness() {
  const context = useContext(BusinessContext)
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider')
  }
  return context
}
