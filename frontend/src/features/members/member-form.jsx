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

/**
 * Create or edit a member. ``defaults`` pre-fills course, group and plan for new members
 * (e.g. when adding from a course or plan), and ``description`` says where they will land.
 */
export function MemberFormDialog({ open, onOpenChange, member, onSaved, defaults, description }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={member ? 'Edit member' : 'New member'} description={member ? undefined : description} className="sm:max-w-lg">
        {open && <MemberForm member={member} defaults={defaults} onDone={(m) => (onOpenChange(false), onSaved?.(m))} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({ member, defaults, onDone, onCancel }) {
  const save = useSaveMember()
  const { data: courses = [] } = useCourses()
  const initial = {
    first_name: member?.first_name ?? '',
    last_name: member?.last_name ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    course_id: member?.course_id ?? defaults?.course_id ?? '',
    group_id: member?.group_id ?? defaults?.group_id ?? '',
    plan_id: member?.plan_id ?? defaults?.plan_id ?? '',
    joined_on: member?.joined_on ?? today(),
    notes: member?.notes ?? '',
    discount_percent: member?.discount_percent ?? '',
    guardian_name: member?.guardian_name ?? '',
    guardian_phone: member?.guardian_phone ?? '',
    guardian_email: member?.guardian_email ?? '',
  }
  const { register, handleSubmit, control, setValue, reset, setFocus, formState: { errors } } = useForm({ defaultValues: initial })
  const courseId = toId(useWatch({ control, name: 'course_id' }))
  const groups = courses.find((c) => c.id === courseId)?.groups ?? []
  const { data: plans = [] } = usePlans(courseId ? { course_id: courseId } : {})

  const submit = (v, another) =>
    save.mutate(
      {
        id: member?.id,
        first_name: v.first_name.trim(),
        last_name: v.last_name.trim(),
        email: blank(v.email),
        phone: blank(v.phone),
        notes: blank(v.notes),
        discount_percent: v.discount_percent === '' ? null : Number(v.discount_percent),
        guardian_name: blank(v.guardian_name),
        guardian_phone: blank(v.guardian_phone),
        guardian_email: blank(v.guardian_email),
        course_id: toId(v.course_id),
        group_id: toId(v.group_id),
        plan_id: toId(v.plan_id),
        joined_on: v.joined_on || null,
      },
      {
        onSuccess: (saved) => {
          if (!another) return onDone(saved)
          // Keep course, group, plan and date so a whole class can be entered in a row.
          reset({ ...initial, course_id: v.course_id, group_id: v.group_id, plan_id: v.plan_id, joined_on: v.joined_on })
          setFocus('first_name')
        },
      },
    )

  return (
    <form className="grid gap-4" onSubmit={(e) => handleSubmit((v) => submit(v, e.nativeEvent.submitter?.value === 'another'))(e)}>
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
          {/* Keyed on the options so a pre-filled value shows once they have loaded. */}
          <Select key={courses.length} {...register('course_id', { onChange: () => (setValue('group_id', ''), setValue('plan_id', '')) })}>
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Group">
          <Select key={`${courseId}-${groups.length}`} disabled={!groups.length} {...register('group_id')}>
            <option value="">None</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plan">
          <Select key={plans.length} {...register('plan_id')}>
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {money(p.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Discount (%)" hint="Applied to plan prices when recording payments.">
          <Input type="number" min={0} max={100} step="0.01" {...register('discount_percent')} />
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
        {!member && (
          <Button type="submit" variant="outline" value="another" disabled={save.isPending}>
            Save & add another
          </Button>
        )}
        <Button type="submit" disabled={save.isPending}>
          {member ? 'Save changes' : 'Add member'}
        </Button>
      </DialogFooter>
    </form>
  )
}
