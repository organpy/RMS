import { Archive, ArchiveRestore, BookOpen, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

import { useCourses, useDeleteCourse, useDeleteGroup, useSaveCourse, useSaveGroup } from './api'

function CourseForm({ course, onDone }) {
  const save = useSaveCourse()
  const { register, handleSubmit } = useForm({ defaultValues: { name: course?.name ?? '', description: course?.description ?? '' } })
  return (
    <form className="grid gap-4" onSubmit={handleSubmit((v) => save.mutate({ id: course?.id, name: v.name.trim(), description: v.description.trim() || null }, { onSuccess: onDone }))}>
      <Field label="Name">
        <Input autoFocus required placeholder="e.g. Grade 5, Piano, CrossFit" {...register('name')} />
      </Field>
      <Field label="Description">
        <Textarea rows={3} {...register('description')} />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={save.isPending}>
          {course ? 'Save' : 'Create course'}
        </Button>
      </DialogFooter>
    </form>
  )
}

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

function CourseCard({ course, onEdit, onGroup }) {
  const save = useSaveCourse()
  const remove = useDeleteCourse()
  const removeGroup = useDeleteGroup()
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 p-5 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-medium">
              <Link to={`/courses/${course.id}`} className="hover:underline">
                {course.name}
              </Link>
            </h2>
            {course.archived && <Badge>Archived</Badge>}
          </div>
          {course.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{course.description}</p>}
          <Link to={`/courses/${course.id}`} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <Users className="size-3.5" /> {course.member_count} members · View roster
          </Link>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Course actions">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </MenuItem>
            <MenuItem onSelect={() => onGroup({})}>
              <Plus /> Add group
            </MenuItem>
            <MenuItem onSelect={() => save.mutate({ id: course.id, archived: !course.archived })}>
              {course.archived ? <ArchiveRestore /> : <Archive />} {course.archived ? 'Restore' : 'Archive'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger disabled={course.member_count > 0} onSelect={() => confirm(`Delete ${course.name}?`) && remove.mutate(course.id)}>
              <Trash2 /> Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <ul className="mt-auto divide-y border-t">
        {course.groups.map((g) => (
          <li key={g.id} className="group flex items-center gap-3 px-5 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{g.name}</p>
              {g.schedule && <p className="truncate text-xs text-muted-foreground">{g.schedule}</p>}
            </div>
            <span className={cn('tabular', g.capacity && g.member_count > g.capacity ? 'text-danger' : 'text-muted-foreground')}>
              {g.member_count}
              {g.capacity ? ` / ${g.capacity}` : ''}
            </span>
            <div className="flex w-0 overflow-hidden group-hover:w-auto focus-within:w-auto">
              <Button variant="ghost" size="icon" aria-label={`Edit ${g.name}`} onClick={() => onGroup(g)}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${g.name}`}
                onClick={() => confirm(`Delete group ${g.name}? Its members stay in ${course.name}.`) && removeGroup.mutate(g.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
        {course.groups.length === 0 && (
          <li className="px-5 py-2.5">
            <button className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => onGroup({})}>
              + Add a group
            </button>
          </li>
        )}
      </ul>
    </Card>
  )
}

export default function CoursesPage() {
  const [archived, setArchived] = useState(false)
  const { data: courses, isPending } = useCourses(archived)
  const [course, setCourse] = useState(null)
  const [group, setGroup] = useState(null)

  return (
    <>
      <PageHeader title="Courses" description="Classes, programmes or activities, each split into optional groups.">
        <Button variant="ghost" onClick={() => setArchived((a) => !a)}>
          {archived ? 'Hide archived' : 'Show archived'}
        </Button>
        <Button onClick={() => setCourse({})}>
          <Plus /> New course
        </Button>
      </PageHeader>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No courses yet" description="Create a course, then add groups such as time slots or levels.">
            <Button onClick={() => setCourse({})}>New course</Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} onEdit={() => setCourse(c)} onGroup={(g) => setGroup({ ...g, courseId: c.id })} />
          ))}
        </div>
      )}

      <Dialog open={!!course} onOpenChange={(o) => !o && setCourse(null)}>
        <DialogContent title={course?.id ? 'Edit course' : 'New course'}>{course && <CourseForm course={course.id ? course : null} onDone={() => setCourse(null)} />}</DialogContent>
      </Dialog>
      <Dialog open={!!group} onOpenChange={(o) => !o && setGroup(null)}>
        <DialogContent title={group?.id ? 'Edit group' : 'New group'}>
          {group && <GroupForm group={group.id ? group : null} courseId={group.courseId} onDone={() => setGroup(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
