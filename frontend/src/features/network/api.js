import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'

export const useNetwork = () => useQuery({ queryKey: ['network'], queryFn: () => api.get('/network'), staleTime: 0 })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The server rebinds right after answering, so wait until it answers again. */
async function waitForServer() {
  await sleep(800)
  for (let i = 0; i < 40; i++) {
    try {
      await api.get('/health')
      return
    } catch {
      await sleep(500)
    }
  }
}

export function useSetNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (enabled) => {
      const res = await api.put('/network', { enabled })
      if (res.restart_supported) await waitForServer()
      return res
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['network'] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      if (!res.restart_supported) toast.info('Saved. Restart RMS to apply it.')
    },
    onError: (e) => toast.error(e.message),
  })
}
