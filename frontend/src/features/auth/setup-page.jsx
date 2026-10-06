import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'

import { useAuthStatus, useSetup } from './api'
import { AuthLayout } from './auth-layout'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'MAD', 'DZD', 'TND', 'XOF', 'AED', 'SAR']

export default function SetupPage() {
  const { data: status } = useAuthStatus()
  const setup = useSetup()
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { currency: 'USD' } })

  if (status && !status.setup_required) return <Navigate to="/" replace />

  return (
    <AuthLayout title="Set up RMS" description="Name your organization and create the first admin account.">
      <form className="grid gap-4" onSubmit={handleSubmit((v) => setup.mutate(v))}>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Organization" error={errors.organization?.message}>
            <Input autoFocus placeholder="Northside Academy" {...register('organization', { required: 'Required' })} />
          </Field>
          <Field label="Currency">
            <Select {...register('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Your name" error={errors.name?.message}>
          <Input autoComplete="name" {...register('name', { required: 'Required' })} />
        </Field>
        <Field label="Username" error={errors.username?.message}>
          <Input
            autoComplete="username"
            {...register('username', {
              required: 'Required',
              pattern: { value: /^[a-zA-Z0-9._-]{3,60}$/, message: 'At least 3 letters, digits, dots or dashes' },
            })}
          />
        </Field>
        <Field label="Password" error={errors.password?.message ?? setup.error?.message} hint="At least 8 characters">
          <Input
            type="password"
            autoComplete="new-password"
            {...register('password', { minLength: { value: 8, message: 'At least 8 characters' } })}
          />
        </Field>
        <Button type="submit" className="mt-2" disabled={setup.isPending}>
          Create organization
        </Button>
      </form>
    </AuthLayout>
  )
}
