import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Dialog from '../ui/Dialog'
import { useToast } from '@/hooks/use-toast'
import { post } from '../../services/api'

const classFormSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required').max(200),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  grouping_type: z.string().optional(),
})

export function ClassCreateDialog({ open, onOpenChange, businessId }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      grouping_type: '',
    },
  })

  const createClassMutation = useMutation({
    mutationFn: async (payload) => {
      return post('/api/classes', {
        business_id: businessId,
        ...payload,
      })
    },
    onSuccess: () => {
      toast({
        title: 'Class created',
        description: 'Your new class has been added successfully.',
      })
      form.reset()
      onOpenChange(false)
      // Invalidate and refetch classes
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to create class',
        description: error?.detail ?? 'Please check your inputs and try again.',
      })
    },
  })

  const onSubmit = useCallback(
    async (values) => {
      createClassMutation.mutate(values)
    },
    [createClassMutation],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Class"
      description="Add a new class to your schedule"
      size="sm"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Class name *</label>
          <Input
            placeholder="Pilates Intro"
            disabled={createClassMutation.isPending}
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
            disabled={createClassMutation.isPending}
            {...form.register('description')}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Start date</label>
            <Input
              type="date"
              disabled={createClassMutation.isPending}
              {...form.register('start_date')}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">End date</label>
            <Input
              type="date"
              disabled={createClassMutation.isPending}
              {...form.register('end_date')}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Grouping type</label>
          <Input
            placeholder="e.g., Morning, Evening, Weekend"
            disabled={createClassMutation.isPending}
            {...form.register('grouping_type')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={createClassMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createClassMutation.isPending}
          >
            {createClassMutation.isPending ? 'Creating...' : 'Create class'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export default ClassCreateDialog
