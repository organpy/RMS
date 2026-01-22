import { useEffect, useMemo } from 'react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import MembershipSelect from './MembershipSelect'
import { memberStatusOptions } from './memberFormSchema'
import { useMemberFilters } from '../../hooks/useMemberFilters'

export function MemberForm({
  form,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Save member',
  cancelLabel = 'Cancel',
  secondaryActions,
  businessId,
}) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form

  const membershipPlan = watch('membership_plan')
  const classIdValue = watch('class_id')
  const groupIdValue = watch('group_id')

  const { classes, classOptions, groupOptions } = useMemberFilters({ enabled: true })

  const normalizedClassId = classIdValue ? Number(classIdValue) : null

  const classPlans = useMemo(() => {
    if (!normalizedClassId) return []
    const match = classes.find((item) => item.id === normalizedClassId)
    return Array.isArray(match?.membership_plans) ? match.membership_plans : []
  }, [classes, normalizedClassId])

  const groupSelectOptions = useMemo(() => {
    if (!groupOptions?.length) return []
    if (!normalizedClassId) return groupOptions
    return groupOptions.filter((option) => option.classId === normalizedClassId)
  }, [groupOptions, normalizedClassId])

  useEffect(() => {
    if (!groupIdValue) return
    if (!normalizedClassId) return
    const stillValid = groupSelectOptions.some((option) => option.value === String(groupIdValue))
    if (!stillValid) {
      setValue('group_id', '')
    }
  }, [groupIdValue, groupSelectOptions, normalizedClassId, setValue])

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-first-name">
            First name
          </label>
          <Input
            id="member-first-name"
            placeholder="Alex"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.first_name)}
            {...register('first_name')}
          />
          {errors.first_name ? (
            <p className="text-xs text-destructive">{errors.first_name.message}</p>
          ) : null}
        </div>
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-last-name">
            Last name
          </label>
          <Input
            id="member-last-name"
            placeholder="Johnson"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.last_name)}
            {...register('last_name')}
          />
          {errors.last_name ? <p className="text-xs text-destructive">{errors.last_name.message}</p> : null}
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <label className="font-medium text-slate-700" htmlFor="member-email">
          Email (optional)
        </label>
        <Input
          id="member-email"
          type="email"
          placeholder="alex@example.com"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-plan">
            Membership plan
          </label>
          {classPlans.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {classPlans.map((plan) => (
                <Button
                  key={`${plan.name}-${plan.interval_days}`}
                  type="button"
                  size="sm"
                  variant={membershipPlan === plan.name ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setValue('membership_plan', plan.name, { shouldDirty: true })
                    setValue('payment_interval_days', plan.interval_days, { shouldDirty: true })
                  }}
                  disabled={isSubmitting}
                >
                  {plan.name} · {plan.interval_days} days
                </Button>
              ))}
            </div>
          ) : null}
          <MembershipSelect
            id="member-plan"
            value={membershipPlan || ''}
            onChange={(plan) => setValue('membership_plan', plan)}
            disabled={isSubmitting}
            businessId={businessId}
          />
        </div>
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-interval">
            Billing interval (days)
          </label>
          <Input
            id="member-interval"
            type="number"
            min="1"
            step="1"
            placeholder="30"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.payment_interval_days)}
            {...register('payment_interval_days')}
          />
          <p className="text-xs text-slate-500">Use 30 for monthly, 60 for bi-monthly, etc.</p>
          {errors.payment_interval_days ? (
            <p className="text-xs text-destructive">{errors.payment_interval_days.message}</p>
          ) : null}
        </div>
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-status">
            Status
          </label>
          <Select
            id="member-status"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.status)}
            {...register('status')}
          >
            {memberStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {errors.status ? <p className="text-xs text-destructive">{errors.status.message}</p> : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-class">
            Class
          </label>
          <Select
            id="member-class"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.class_id)}
            {...register('class_id')}
          >
            <option value="">No class</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {errors.class_id ? <p className="text-xs text-destructive">{errors.class_id.message}</p> : null}
        </div>
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700" htmlFor="member-group">
            Group
          </label>
          <Select
            id="member-group"
            disabled={isSubmitting || groupSelectOptions.length === 0}
            aria-invalid={Boolean(errors.group_id)}
            {...register('group_id')}
          >
            <option value="">No group</option>
            {groupSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {errors.group_id ? <p className="text-xs text-destructive">{errors.group_id.message}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {secondaryActions ?? null}
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
