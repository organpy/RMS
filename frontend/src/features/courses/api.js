import { useQuery } from '@tanstack/react-query'

import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

const ROOTS = ['courses', 'members', 'plans']

export const useCourses = (includeArchived = false) =>
  useQuery({ queryKey: ['courses', { includeArchived }], queryFn: () => api.get('/courses', { include_archived: includeArchived }) })

export const useSaveCourse = () =>
  useMutate(({ id, ...body }) => (id ? api.patch(`/courses/${id}`, body) : api.post('/courses', body)), {
    invalidate: ROOTS,
    success: (_, v) => (v.id ? 'Course updated' : 'Course created'),
  })

export const useDeleteCourse = () => useMutate((id) => api.del(`/courses/${id}`), { invalidate: ROOTS, success: 'Course deleted' })

export const useSaveGroup = () =>
  useMutate(({ id, course_id, ...body }) => (id ? api.patch(`/groups/${id}`, body) : api.post(`/courses/${course_id}/groups`, body)), {
    invalidate: ROOTS,
    success: (_, v) => (v.id ? 'Group updated' : 'Group created'),
  })

export const useDeleteGroup = () => useMutate((id) => api.del(`/groups/${id}`), { invalidate: ROOTS, success: 'Group deleted' })
