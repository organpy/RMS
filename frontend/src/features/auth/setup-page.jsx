import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { api } from '@/lib/api'

import { useAuthStatus, useSetup } from './api'
import { AuthLayout } from './auth-layout'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'MAD', 'DZD', 'TND', 'XOF', 'AED', 'SAR']

/** Start this install from a backup: how data moves to a new version or another computer. */
function RestoreForm({ onBack }) {
  const qc = useQueryClient()
  const [file, setFile] = useState(null)
  const restore = useMutation({
    mutationFn: () => {
      const body = new FormData()
      body.append('file', file)
      return api.post('/auth/setup/restore', body)
    },
    onSuccess: () => {
      toast.success('Your data is restored. Sign in with your existing account.')
      qc.setQueryData(['auth-status'], { setup_required: false })
    },
  })
  return (
    <AuthLayout
      title="Restore from a backup"
      description="Moving from an earlier version or another computer? Upload a backup from Settings → Backups. Your accounts, members and payments all come with it."
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          restore.mutate()
        }}
      >
        <Field label="Backup file" error={restore.error?.message} hint="A .zip that starts with rms-">
          <Input type="file" accept=".zip,application/zip" required className="py-1.5" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Button type="submit" disabled={!file || restore.isPending}>
          {restore.isPending ? 'Restoring…' : 'Restore'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to a new setup
        </Button>
      </form>
    </AuthLayout>
  )
}

export default function SetupPage() {
  const [restoring, setRestoring] = useState(false)
  const { data: status } = useAuthStatus()
  const setup = useSetup()
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { currency: 'USD' } })

  // A brand-new install lands on the setup guide; anyone else visiting /setup goes home.
  if (status && !status.setup_required) return <Navigate to={setup.isSuccess ? '/getting-started?welcome=1' : '/'} replace />
  if (restoring) return <RestoreForm onBack={() => setRestoring(false)} />

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
        <p className="text-center text-[13px] text-muted-foreground">
          Already using RMS?{' '}
          <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setRestoring(true)}>
            Restore from a backup
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
