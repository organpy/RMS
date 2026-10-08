import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Read and patch URL search params so filters survive reloads and are shareable. */
export function useParamsState() {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(params)
  const patch = useCallback(
    (next) =>
      setParams(
        (prev) => {
          const merged = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(next)) {
            if (v === undefined || v === null || v === '') merged.delete(k)
            else merged.set(k, v)
          }
          return merged
        },
        { replace: true },
      ),
    [setParams],
  )
  return [values, patch]
}
