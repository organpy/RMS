import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useCourses } from '@/features/courses/api'
import { usePlans } from '@/features/plans/api'
import { money, today } from '@/lib/format'

import { useSaveMember } from './api'

const toId = (v) => (v ? Number(v) : null)
const blank = (v) => v?.trim() || null

export function MemberFormDialog({ open, onOpenChange, member, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={member ? 'Edit member' : 'New member'} className="max-w-lg">
        {open && <MemberForm member={member} onDone={(m) => (onOpenChange(false), onSaved?.(m))} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({ member, onDone, onCancel }) {
  const save = useSaveMember()
  const { data: courses = [] } = useCourses()
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm({
    defaultValues: {
      first_name: member?.first_name ?? '',
      last_name: member?.last_name ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      course_id: member?.course_id ?? '',
      group_id: member?.group_id ?? '',
      plan_id: member?.plan_id ?? '',
      joined_on: member?.joined_on ?? today(),
      notes: member?.notes ?? '',
      guardian_name: member?.guardian_name ?? '',
      guardian_phone: member?.guardian_phone ?? '',
      guardian_email: member?.guardian_email ?? '',
    },
  })
  const courseId = toId(useWatch({ control, name: 'course_id' }))
  const groups = courses.find((c) => c.id === courseId)?.groups ?? []
  const { data: plans = [] } = usePlans(courseId ? { course_id: courseId } : {})

  const submit = (v) =>
    save.mutate(
      {
        id: member?.id,
        first_name: v.first_name.trim(),
        last_name: v.last_name.trim(),
        email: blank(v.email),
        phone: blank(v.phone),
        notes: blank(v.notes),
        guardian_name: blank(v.guardian_name),
        guardian_phone: blank(v.guardian_phone),
        guardian_email: blank(v.guardian_email),
        course_id: toId(v.course_id),
        group_id: toId(v.group_id),
        plan_id: toId(v.plan_id),
        joined_on: v.joined_on || null,
      },
      { onSuccess: onDone },
    )

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.first_name && 'Required'}>
          <Input autoFocus {...register('first_name', { required: true, validate: (v) => !!v.trim() })} />
        </Field>
        <Field label="Last name" error={errors.last_name && 'Required'}>
          <Input {...register('last_name', { required: true, validate: (v) => !!v.trim() })} />
        </Field>
        <Field label="Email">
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Phone">
          <Input type="tel" {...register('phone')} />
        </Field>
        <Field label="Course">
          <Select {...register('course_id', { onChange: () => (setValue('group_id', ''), setValue('plan_id', '')) })}>
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Group">
          <Select disabled={!groups.length} {...register('group_id')}>
            <option value="">None</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plan">
          <Select {...register('plan_id')}>
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {money(p.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Joined on">
          <Input type="date" {...register('joined_on')} />
        </Field>
      </div>
      <details className="group rounded-lg border px-3 py-2" open={!!(member?.guardian_name || member?.guardian_phone || member?.guardian_email)}>
        <summary className="cursor-pointer text-[13px] font-medium">Parent or guardian</summary>
        <p className="mt-1 text-xs text-muted-foreground">Messages and invoices go to the guardian first when a contact is set.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2">
            <Input {...register('guardian_name')} />
          </Field>
          <Field label="Email">
            <Input type="email" {...register('guardian_email')} />
          </Field>
          <Field label="Phone">
            <Input type="tel" {...register('guardian_phone')} />
          </Field>
        </div>
      </details>
      <Field label="Notes">
        <Textarea rows={2} {...register('notes')} />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {member ? 'Save changes' : 'Add member'}
        </Button>
      </DialogFooter>
    </form>
  )
}
