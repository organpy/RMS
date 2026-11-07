import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Tags, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/dropdown'
import { Field, Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { useCourses } from '@/features/courses/api'
import { planTarget } from '@/features/courses/targets'
import { AddMembersMenu } from '@/features/members/add-members'
import { money } from '@/lib/format'

import { usePlans, useSavePlan } from './api'
import { intervalLabel, PRESETS } from './interval'

function PlanForm({ plan, onDone }) {
  const save = useSavePlan()
  const { data: courses = [] } = useCourses()
  const preset = plan && !PRESETS.some(([d]) => d === plan.interval_days) ? 'custom' : String(plan?.interval_days ?? 30)
  const { register, handleSubmit, control } = useForm({
    defaultValues: { name: plan?.name ?? '', price: plan?.price ?? '', preset, interval_days: plan?.interval_days ?? 30, course_id: plan?.course_id ?? '' },
  })
  const custom = useWatch({ control, name: 'preset' }) === 'custom'
  const submit = (v) =>
    save.mutate(
      {
        id: plan?.id,
        name: v.name.trim(),
        price: Number(v.price).toFixed(2),
        interval_days: Number(custom ? v.interval_days : v.preset),
        course_id: v.course_id ? Number(v.course_id) : null,
      },
      { onSuccess: onDone },
    )
  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
      <Field label="Name">
        <Input autoFocus required placeholder="e.g. Monthly, Term 1" {...register('name')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price">
          <Input type="number" step="0.01" min="0" required {...register('price')} />
        </Field>
        <Field label="Billing period">
          <Select {...register('preset')}>
            {PRESETS.map(([d, l]) => (
              <option key={d} value={d}>
                {l}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </Select>
        </Field>
      </div>
      {custom && (
        <Field label="Days covered per payment">
          <Input type="number" min={1} max={3660} required {...register('interval_days')} />
        </Field>
      )}
      <Field label="Available for" hint="Limit the plan to one course, or offer it to everyone.">
        <Select {...register('course_id')}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={save.isPending}>
          {plan ? 'Save' : 'Create plan'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function PlansPage() {
  const [archived, setArchived] = useState(false)
  const { data: plans, isPending } = usePlans({ include_archived: archived })
  const save = useSavePlan()
  const [editing, setEditing] = useState(null)

  return (
    <>
      <PageHeader title="Plans" description="What members pay and how long each payment covers.">
        <Button variant="ghost" onClick={() => setArchived((a) => !a)}>
          {archived ? 'Hide archived' : 'Show archived'}
        </Button>
        <Button onClick={() => setEditing({})}>
          <Plus /> New plan
        </Button>
      </PageHeader>
      <Card>
        {isPending ? (
          <div className="grid gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState icon={Tags} title="No plans yet" description="Plans set the price and coverage of a payment, e.g. Monthly · 45.">
            <Button onClick={() => setEditing({})}>New plan</Button>
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Period</TH>
                <TH className="hidden sm:table-cell">Available for</TH>
                <TH className="hidden text-right sm:table-cell">Members</TH>
                <TH className="text-right">Price</TH>
                <TH className="w-24" />
              </TR>
            </THead>
            <tbody>
              {plans.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <span className="font-medium">{p.name}</span> {p.archived && <Badge className="ml-1">Archived</Badge>}
                    <p className="text-xs text-muted-foreground sm:hidden">
                      <Link to={`/members?plan_id=${p.id}`} className="hover:text-foreground hover:underline">
                      {p.member_count} member{p.member_count === 1 ? '' : 's'}
                    </Link>
                    </p>
                  </TD>
                  <TD className="text-muted-foreground">{intervalLabel(p.interval_days)}</TD>
                  <TD className="hidden text-muted-foreground sm:table-cell">{p.course_name ?? 'All courses'}</TD>
                  <TD className="hidden text-right text-muted-foreground tabular sm:table-cell">
                    <Link to={`/members?plan_id=${p.id}`} className="hover:text-foreground hover:underline">
                      {p.member_count} member{p.member_count === 1 ? '' : 's'}
                    </Link>
                  </TD>
                  <TD className="text-right font-medium tabular">{money(p.price)}</TD>
                  <TD className="text-right whitespace-nowrap">
                    {!p.archived && (
                      <AddMembersMenu
                        target={planTarget(p)}
                        trigger={
                          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Add members to ${p.name}`} title="Add members">
                            <UserPlus />
                          </Button>
                        }
                      />
                    )}
                    <Menu>
                      <MenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Actions for ${p.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </MenuTrigger>
                      <MenuContent align="end">
                        <MenuItem onSelect={() => setEditing(p)}>
                          <Pencil /> Edit
                        </MenuItem>
                        <MenuItem onSelect={() => save.mutate({ id: p.id, archived: !p.archived })}>
                          {p.archived ? <ArchiveRestore /> : <Archive />} {p.archived ? 'Restore' : 'Archive'}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing?.id ? 'Edit plan' : 'New plan'} description="Price changes apply to future payments only.">
          {editing && <PlanForm plan={editing.id ? editing : null} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
