import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { put } from '../../services/api'

const DEFAULT_INTERVALS = [30, 60, 90]

export function ClassMembershipPlansDialog({ open, onOpenChange, classItem }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [plans, setPlans] = useState([])
  const [newPlanName, setNewPlanName] = useState('')
  const [newIntervalDays, setNewIntervalDays] = useState('30')

  useEffect(() => {
    if (!open) return
    const existing = Array.isArray(classItem?.membership_plans) ? classItem.membership_plans : []
    setPlans(
      existing.map((plan) => ({
        name: plan.name ?? '',
        interval_days: plan.interval_days ?? 30,
      })),
    )
    setNewPlanName('')
    setNewIntervalDays('30')
  }, [classItem, open])

  const createPlanMutation = useMutation({
    mutationFn: async (payload) => put(`/api/classes/${classItem.id}`, payload),
    onSuccess: () => {
      toast({
        title: 'Plans updated',
        description: 'Membership plans have been saved for this class.',
      })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to save plans',
        description: error?.detail ?? 'Please try again later.',
      })
    },
  })

  const canAddPlan = newPlanName.trim().length > 0 && Number(newIntervalDays) > 0

  const handleAddPlan = useCallback(() => {
    if (!canAddPlan) return
    const interval = Number(newIntervalDays)
    setPlans((current) => [
      ...current,
      {
        name: newPlanName.trim(),
        interval_days: interval,
      },
    ])
    setNewPlanName('')
    setNewIntervalDays('30')
  }, [canAddPlan, newIntervalDays, newPlanName])

  const handleRemovePlan = useCallback((index) => {
    setPlans((current) => current.filter((_, idx) => idx !== index))
  }, [])

  const handleSave = useCallback(() => {
    if (!classItem?.id) return
    createPlanMutation.mutate({ membership_plans: plans })
  }, [classItem?.id, createPlanMutation, plans])

  const isSaving = createPlanMutation.isPending

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

  const hasDuplicates = duplicateNames.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Membership plans</DialogTitle>
          <DialogDescription>
            Define default membership plans for {classItem?.name ?? 'this class'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1 text-sm">
              <label className="font-medium text-slate-700" htmlFor="plan-name">
                Plan name
              </label>
              <Input
                id="plan-name"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
                placeholder="Monthly"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label className="font-medium text-slate-700" htmlFor="plan-interval">
                Interval (days)
              </label>
              <Input
                id="plan-interval"
                type="number"
                min="1"
                step="1"
                value={newIntervalDays}
                onChange={(event) => setNewIntervalDays(event.target.value)}
                disabled={isSaving}
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
                disabled={isSaving}
              >
                {days} days
              </Button>
            ))}
            <Button type="button" size="sm" onClick={handleAddPlan} disabled={!canAddPlan || isSaving}>
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
                    disabled={isSaving}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No plans added yet.</p>
          )}

          {hasDuplicates ? (
            <p className="text-xs text-destructive">Plan names must be unique.</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || hasDuplicates}>
            {isSaving ? 'Saving…' : 'Save plans'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ClassMembershipPlansDialog
