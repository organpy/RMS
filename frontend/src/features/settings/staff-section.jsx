import { useQuery } from '@tanstack/react-query'
import { KeyRound, MoreHorizontal, Plus, ShieldCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/dropdown'
import { Field, Input, Select } from '@/components/ui/input'
import { useMe } from '@/features/auth/api'
import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'
import { date } from '@/lib/format'

import { Section } from './section'

function AddStaff({ onDone }) {
  const create = useMutate((body) => api.post('/staff', body), { invalidate: ['staff'], success: 'Staff account created', onSuccess: onDone })
  const { register, handleSubmit } = useForm({ defaultValues: { role: 'staff' } })
  return (
    <form className="grid gap-4" onSubmit={handleSubmit((v) => create.mutate(v))}>
      <Field label="Name">
        <Input autoFocus required {...register('name')} />
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Username">
          <Input required pattern="[a-zA-Z0-9._\-]{3,60}" title="3+ letters, digits, dots or dashes" {...register('username')} />
        </Field>
        <Field label="Role">
          <Select {...register('role')}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
      </div>
      <Field label="Temporary password" hint="At least 8 characters. Ask them to change it after signing in.">
        <Input type="password" autoComplete="new-password" minLength={8} required {...register('password')} />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={create.isPending}>
          Create account
        </Button>
      </DialogFooter>
    </form>
  )
}

export function StaffSection() {
  const { data: me } = useMe()
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => api.get('/staff') })
  const update = useMutate(({ id, ...body }) => api.patch(`/staff/${id}`, body), { invalidate: ['staff'], success: 'Account updated' })
  const [adding, setAdding] = useState(false)

  const resetPassword = (s) => {
    const password = prompt(`New password for ${s.name} (min. 8 characters)`)
    if (password) update.mutate({ id: s.id, password })
  }

  return (
    <Section id="staff" title="Staff" description="Admins manage settings, staff and backups. Staff handle members and payments.">
      <div className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.name} {s.id === me?.id && <span className="text-muted-foreground">(you)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{s.username} · {s.last_login_at ? `last seen ${date(s.last_login_at)}` : 'never signed in'}
                </p>
              </div>
              {!s.active && <Badge tone="danger">Disabled</Badge>}
              <Badge>{s.role === 'admin' ? 'Admin' : 'Staff'}</Badge>
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Actions for ${s.name}`} disabled={s.id === me?.id}>
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => update.mutate({ id: s.id, role: s.role === 'admin' ? 'staff' : 'admin' })}>
                    <ShieldCheck /> {s.role === 'admin' ? 'Make staff' : 'Make admin'}
                  </MenuItem>
                  <MenuItem onSelect={() => resetPassword(s)}>
                    <KeyRound /> Reset password
                  </MenuItem>
                  <MenuItem danger={s.active} onSelect={() => update.mutate({ id: s.id, active: !s.active })}>
                    <UserX /> {s.active ? 'Disable account' : 'Enable account'}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
        <div>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Add staff
          </Button>
        </div>
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title="Add staff">{adding && <AddStaff onDone={() => setAdding(false)} />}</DialogContent>
      </Dialog>
    </Section>
  )
}
