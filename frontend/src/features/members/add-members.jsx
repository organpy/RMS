import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/dropdown'
import { Input } from '@/components/ui/input'
import { useDebounced } from '@/hooks/use-debounced'
import { usePlans } from '@/features/plans/api'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

import { useMembers } from './api'
import { MemberFormDialog } from './member-form'

/**
 * Where members are being added, e.g. a course group or a plan:
 *   label    shown in dialogs ("Piano · Beginners")
 *   defaults pre-filled on the new-member form
 *   assign   PATCH body that enrolls an existing member
 *   filter   extra /members query params limiting who can be picked
 *   isIn     whether a member is already there
 */
export function AddMembersMenu({ target, trigger, align = 'end' }) {
  const [mode, setMode] = useState(null)
  return (
    <>
      <Menu>
        <MenuTrigger asChild>{trigger}</MenuTrigger>
        <MenuContent align={align}>
          <MenuItem onSelect={() => setMode('new')}>
            <UserPlus /> New member
          </MenuItem>
          <MenuItem onSelect={() => setMode('existing')}>
            <Users /> Existing members…
          </MenuItem>
        </MenuContent>
      </Menu>
      <MemberFormDialog open={mode === 'new'} onOpenChange={(o) => !o && setMode(null)} defaults={target.defaults} description={`Joins ${target.label}.`} />
      <EnrollDialog open={mode === 'existing'} onOpenChange={(o) => !o && setMode(null)} target={target} />
    </>
  )
}

function useEnroll(target) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => api.patch(`/members/${id}`, target.assign)))
      const failed = results.filter((r) => r.status === 'rejected')
      return { added: ids.length - failed.length, error: failed[0]?.reason?.message }
    },
    onSuccess: ({ added, error }) => {
      for (const key of ['members', 'courses', 'roster', 'plans', 'dashboard', 'onboarding']) qc.invalidateQueries({ queryKey: [key] })
      if (added) toast.success(`${added} member${added === 1 ? '' : 's'} added to ${target.label}`)
      if (error) toast.error(error)
    },
  })
}

function where(m, target, planCourse) {
  const course = target.assign.course_id
  if (course && m.course_id !== course && !m.course_id) return `Joins ${target.courseName ?? 'the course'}`
  if (course && m.course_id && m.course_id !== course) {
    // the server clears a plan only the old course offers, unless this target sets the plan itself
    const drops = !target.assign.plan_id && planCourse[m.plan_id] && planCourse[m.plan_id] !== course
    return `Moves from ${m.course_name}${drops ? `; ${m.plan_name} is cleared, as only ${m.course_name} offers it` : ''}`
  }
  return [m.course_name && [m.course_name, m.group_name].filter(Boolean).join(' · '), m.plan_name].filter(Boolean).join(' — ') || 'No course or plan'
}

export function EnrollDialog({ open, onOpenChange, target }) {
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(() => new Set())
  const q = useDebounced(search.trim(), 200)
  const { data, isPending } = useMembers({ q, size: 50, sort: 'name', ...target.filter }, { enabled: open })
  const enroll = useEnroll(target)
  const { data: plans = [] } = usePlans({ include_archived: true })
  const planCourse = Object.fromEntries(plans.map((p) => [p.id, p.course_id]))
  const toggle = (id) => setPicked((p) => (p.has(id) ? (p.delete(id), new Set(p)) : new Set(p.add(id))))
  const close = (o) => {
    if (!o) {
      setSearch('')
      setPicked(new Set())
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={`Add to ${target.label}`} description="Pick people who are already members. New sign-ups go through “New member” instead." className="sm:max-w-lg">
        <div className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="pl-9" />
        </div>
        <ul className="-mx-1 max-h-[45dvh] divide-y overflow-y-auto rounded-lg border sm:max-h-80">
          {isPending && <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">Loading…</li>}
          {data?.items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">No members found.</li>}
          {data?.items.map((m) => {
            const already = target.isIn(m)
            return (
              <li key={m.id}>
                <label className={cn('flex items-center gap-3 px-3 py-2.5 text-[13px]', already ? 'opacity-60' : 'cursor-pointer hover:bg-surface')}>
                  <input type="checkbox" className="accent-accent" disabled={already} checked={already || picked.has(m.id)} onChange={() => toggle(m.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{already ? 'Already here' : where(m, target, planCourse)}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {data?.total > data?.items.length && <p className="-mt-2 text-xs text-muted-foreground">Showing the first {data.items.length} of {data.total}. Search to find others.</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button disabled={!picked.size || enroll.isPending} onClick={() => enroll.mutate([...picked], { onSuccess: () => close(false) })}>
            Add {picked.size || ''} member{picked.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
