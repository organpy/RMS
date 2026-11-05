import { useCallback, useState } from 'react'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** useState that survives reloads; per browser, for UI preferences only. */
export function useStored(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback))
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(v))
        } catch {
          /* storage unavailable: keep it in memory */
        }
        return v
      }),
    [key],
  )
  return [value, set]
}
