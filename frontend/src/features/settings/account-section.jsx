import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'

import { Section } from './section'

export function AccountSection() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const change = useMutate((body) => api.post('/auth/password', body), { success: 'Password changed', onSuccess: () => reset() })
  return (
    <Section id="account" title="Your account" description="Change the password you use to sign in.">
      <form className="grid gap-4 sm:max-w-sm" onSubmit={handleSubmit(({ current, new: next }) => change.mutate({ current, new: next }))}>
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" required {...register('current')} />
        </Field>
        <Field label="New password" error={errors.new?.message}>
          <Input type="password" autoComplete="new-password" {...register('new', { minLength: { value: 8, message: 'At least 8 characters' } })} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirm', { validate: (v, all) => v === all.new || 'Passwords do not match' })} />
        </Field>
        <div>
          <Button type="submit" variant="outline" disabled={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  )
}
