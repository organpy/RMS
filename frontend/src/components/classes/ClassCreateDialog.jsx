import { useState, useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { post } from '../../services/api'

const classFormSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required').max(200),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  grouping_type: z.string().optional(),
})

const DEFAULT_INTERVALS = [30, 60, 90]

export function ClassCreateDialog({ open, onOpenChange, businessId }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [plans, setPlans] = useState([])
  const [newPlanName, setNewPlanName] = useState('')
  const [newIntervalDays, setNewIntervalDays] = useState('30')

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
        membership_plans: plans,
        ...payload,
      })
    },
    onSuccess: () => {
      toast({
        title: 'Class created',
        description: 'Your new class has been added successfully.',
      })
      form.reset()
      setPlans([])
      setNewPlanName('')
      setNewIntervalDays('30')
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

  const canAddPlan = newPlanName.trim().length > 0 && Number(newIntervalDays) > 0

  const handleAddPlan = useCallback(() => {
    if (!canAddPlan) return
    const interval = Number(newIntervalDays)
    setPlans((current) => [
      ...current,
      { name: newPlanName.trim(), interval_days: interval },
    ])
    setNewPlanName('')
    setNewIntervalDays('30')
  }, [canAddPlan, newIntervalDays, newPlanName])

  const handleRemovePlan = useCallback((index) => {
    setPlans((current) => current.filter((_, idx) => idx !== index))
  }, [])

  const duplicateNames = useMemo(() => {
    const counts = plans.reduce((acc, plan) => {
      const key = plan.name.trim().toLowerCase()
      if (!key) return acc
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  }, [plans])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Class</DialogTitle>
          <DialogDescription>Add a new class to your schedule</DialogDescription>
        </DialogHeader>
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

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Membership plans</p>
            <p className="text-xs text-slate-500">Add default plans for this class (e.g., Monthly 30 days).</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1 text-sm">
              <label className="font-medium text-slate-700" htmlFor="class-plan-name">
                Plan name
              </label>
              <Input
                id="class-plan-name"
                placeholder="Monthly"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
                disabled={createClassMutation.isPending}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label className="font-medium text-slate-700" htmlFor="class-plan-interval">
                Interval (days)
              </label>
              <Input
                id="class-plan-interval"
                type="number"
                min="1"
                step="1"
                value={newIntervalDays}
                onChange={(event) => setNewIntervalDays(event.target.value)}
                disabled={createClassMutation.isPending}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_INTERVALS.map((days) => (
              <Button
                key={days}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNewIntervalDays(String(days))}
                disabled={createClassMutation.isPending}
              >
                {days} days
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              onClick={handleAddPlan}
              disabled={!canAddPlan || createClassMutation.isPending}
            >
              Add plan
            </Button>
          </div>
          {plans.length > 0 ? (
            <div className="space-y-2">
              {plans.map((plan, index) => (
                <div
                  key={`${plan.name}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.interval_days} days</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePlan(index)}
                    disabled={createClassMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No plans added yet.</p>
          )}
          {duplicateNames.length > 0 ? (
            <p className="text-xs text-destructive">Plan names must be unique.</p>
          ) : null}
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
            disabled={createClassMutation.isPending || duplicateNames.length > 0}
          >
            {createClassMutation.isPending ? 'Creating...' : 'Create class'}
          </Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  )
}

export default ClassCreateDialog
