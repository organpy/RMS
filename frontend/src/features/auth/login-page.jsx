import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'

import { useLogin, useMe } from './api'
import { AuthLayout } from './auth-layout'

export default function LoginPage() {
  const { data: me } = useMe()
  const login = useLogin()
  const location = useLocation()
  const { register, handleSubmit } = useForm()

  if (me) return <Navigate to={location.state?.from ?? '/'} replace />

  return (
    <AuthLayout title="Sign in" description="Welcome back. Enter your staff credentials.">
      <form className="grid gap-4" onSubmit={handleSubmit((v) => login.mutate(v))}>
        <Field label="Username">
          <Input autoComplete="username" autoFocus required {...register('username')} />
        </Field>
        <Field label="Password" error={login.error?.message}>
          <Input type="password" autoComplete="current-password" required {...register('password')} />
        </Field>
        <Button type="submit" className="mt-2" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
