import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/** Mutation that invalidates the given query roots and reports errors as toasts. */
export function useMutate(mutationFn, { invalidate = [], success, onSuccess } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (data, vars) => {
      for (const key of invalidate) qc.invalidateQueries({ queryKey: [key] })
      const message = typeof success === 'function' ? success(data, vars) : success
      if (message) toast.success(message)
      onSuccess?.(data, vars)
    },
    onError: (error) => toast.error(error.message),
  })
}
