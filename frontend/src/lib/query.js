import { keepPreviousData, QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      retry: (count, error) => count < 1 && !(error?.status >= 400 && error?.status < 500),
    },
  },
})
