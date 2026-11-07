import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'

import { useSaveGroup } from './api'

function GroupForm({ group, courseId, onDone }) {
  const save = useSaveGroup()
  const { register, handleSubmit } = useForm({ defaultValues: { name: group?.name ?? '', schedule: group?.schedule ?? '', capacity: group?.capacity ?? '' } })
  const submit = (v) =>
    save.mutate(
      { id: group?.id, course_id: courseId, name: v.name.trim(), schedule: v.schedule.trim() || null, capacity: v.capacity ? Number(v.capacity) : null },
      { onSuccess: onDone },
    )
  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
      <Field label="Name">
        <Input autoFocus required placeholder="e.g. Morning, Group B" {...register('name')} />
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Schedule" hint="Free text, e.g. Mon & Wed 18:00">
          <Input {...register('schedule')} />
        </Field>
        <Field label="Capacity">
          <Input type="number" min={1} {...register('capacity')} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={save.isPending}>
          {group ? 'Save' : 'Add group'}
        </Button>
      </DialogFooter>
    </form>
  )
}


/** Add or edit a group; ``group`` is ``{ courseId }`` for a new one, or a group with ``courseId``. */
export function GroupDialog({ group, onOpenChange }) {
  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent title={group?.id ? 'Edit group' : 'New group'}>
        {group && <GroupForm group={group.id ? group : null} courseId={group.courseId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
