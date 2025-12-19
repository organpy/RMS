import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Dialog from '../ui/Dialog'
import { useToast } from '@/hooks/use-toast'
import { post } from '../../services/api'

const groupFormSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(150),
  description: z.string().optional(),
})

export function GroupCreateDialog({ open, onOpenChange, classId, className }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const createGroupMutation = useMutation({
    mutationFn: async (payload) => {
      return post('/api/groups', {
        class_id: classId,
        ...payload,
      })
    },
    onSuccess: () => {
      toast({
        title: 'Group created',
        description: `New group added to "${className}".`,
      })
      form.reset()
      onOpenChange(false)
      // Invalidate and refetch classes (which includes groups)
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to create group',
        description: error?.detail ?? 'Please check your inputs and try again.',
      })
    },
  })

  const onSubmit = useCallback(
    async (values) => {
      createGroupMutation.mutate(values)
    },
    [createGroupMutation],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Create Group in "${className}"`}
      description="Add a new group to this class"
      size="sm"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Group name *</label>
          <Input
            placeholder="Morning Cohort"
            disabled={createGroupMutation.isPending}
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <Input
            placeholder="Optional description"
            disabled={createGroupMutation.isPending}
            {...form.register('description')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={createGroupMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createGroupMutation.isPending}
          >
            {createGroupMutation.isPending ? 'Creating...' : 'Create group'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export default GroupCreateDialog
