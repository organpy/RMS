import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

const ROOTS = ['expenses', 'reports', 'analytics']

export const useExpenses = (params) => useQuery({ queryKey: ['expenses', params], queryFn: () => api.get('/expenses', params) })

export const useExpenseCategories = () => useQuery({ queryKey: ['expenses', 'categories'], queryFn: () => api.get('/expenses/categories') })

export const useSaveExpense = () =>
  useMutate(({ id, ...body }) => (id ? api.patch(`/expenses/${id}`, body) : api.post('/expenses', body)), {
    invalidate: ROOTS,
    success: (_, v) => (v.id ? 'Expense updated' : 'Expense added'),
  })

export const useDeleteExpense = () => useMutate((id) => api.del(`/expenses/${id}`), { invalidate: ROOTS, success: 'Expense deleted' })
