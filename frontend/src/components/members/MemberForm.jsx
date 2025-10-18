import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import { memberStatusOptions } from './memberFormSchema'

export function MemberForm({
  form,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Save member',
  cancelLabel = 'Cancel',
  secondaryActions,
}) {
  const {
    register,
    formState: { errors },
  } = form

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
          Email
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
          <Input
            id="member-plan"
            placeholder="Premium"
            disabled={isSubmitting}
            {...register('membership_plan')}
          />
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
