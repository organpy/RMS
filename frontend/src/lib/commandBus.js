const COMMAND_STORAGE_KEY = 'registration-management:pending-command'

export function emitCommand(name, detail = {}, options = {}) {
  if (typeof window === 'undefined') return
  const payload = {
    name,
    detail,
    issuedAt: Date.now(),
  }

  window.dispatchEvent(new CustomEvent('app:command', { detail: payload }))

  if (options.persist) {
    try {
      sessionStorage.setItem(COMMAND_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.error('Unable to persist command payload', error)
    }
  }
}

export function consumePendingCommand() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(COMMAND_STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(COMMAND_STORAGE_KEY)
    return JSON.parse(raw)
  } catch (error) {
    console.error('Unable to consume pending command', error)
    return null
  }
}
