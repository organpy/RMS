import { useEffect } from 'react'
import { consumePendingCommand } from '@/lib/commandBus'

export function useCommand(commandName, handler) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof handler !== 'function') {
      return undefined
    }

    const listener = (event) => {
      if (event.detail?.name !== commandName) return
      handler(event.detail.detail ?? {}, event.detail)
    }

    window.addEventListener('app:command', listener)

    const pending = consumePendingCommand()
    if (pending?.name === commandName) {
      handler(pending.detail ?? {}, pending)
    }

    return () => {
      window.removeEventListener('app:command', listener)
    }
  }, [commandName, handler])
}
