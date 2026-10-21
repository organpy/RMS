import { ArrowLeft, ArrowRightLeft, ClipboardCheck, MessageSquare, MoreHorizontal, Printer, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/dropdown'
import { Skeleton } from '@/components/ui/skeleton'
import { AttendanceDialog } from '@/features/attendance/attendance-dialog'
import { SendMessageDialog } from '@/features/messaging/send-dialog'
import { cn } from '@/lib/cn'
import { date } from '@/lib/format'

import { useMoveMember, useRoster } from './api'

function CapacityBar({ count, capacity }) {
  if (!capacity) return null
  const pct = Math.min(100, (count / capacity) * 100)
  return (
    <div className="h-1 overflow-hidden rounded-full bg-muted print:hidden" role="meter" aria-valuenow={count} aria-valuemax={capacity} aria-label="Capacity">
      <div className={cn('h-full rounded-full', count > capacity ? 'bg-danger' : count === capacity ? 'bg-warning' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MemberRow({ member, groups, currentGroupId }) {
  const move = useMoveMember()
  const targets = [...groups.filter((g) => g.id !== currentGroupId), ...(currentGroupId ? [{ id: null, name: 'No group' }] : [])]
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-[13px]">
      <div className="min-w-0 flex-1">
        <Link to={`/members?open=${member.id}`} className="font-medium hover:underline">
          {member.full_name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{[member.plan_name, member.paid_until && `until ${date(member.paid_until)}`].filter(Boolean).join(' · ') || member.phone || member.email}</p>
      </div>
      {member.attendance_rate != null && (
        <span className={cn('tabular text-xs', member.attendance_rate < 0.75 ? 'text-warning' : 'text-muted-foreground')} title="Attendance, last 90 days">
          {Math.round(member.attendance_rate * 100)}%
        </span>
      )}
      <StatusBadge status={member.status} />
      {targets.length > 0 && (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${member.full_name}`} className="print:hidden">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Move to</MenuLabel>
            {targets.map((g) => (
              <MenuItem key={g.id ?? 'none'} onSelect={() => move.mutate({ id: member.id, group_id: g.id })}>
                <ArrowRightLeft /> {g.name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
    </li>
  )
}

function GroupCard({ group, groups, onMessage, onAttendance }) {
  const over = group.capacity && group.member_count > group.capacity
  return (
    <Card className="break-inside-avoid">
      <div className="grid gap-2 border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">{group.name}</h2>
            {group.schedule && <p className="text-xs text-muted-foreground">{group.schedule}</p>}
          </div>
          <span className={cn('tabular text-[13px]', over ? 'text-danger' : 'text-muted-foreground')}>
            {group.member_count}
            {group.capacity ? ` / ${group.capacity}` : ''}
          </span>
          {group.id && group.members.length > 0 && (
            <div className="-my-1 flex print:hidden">
              <Button variant="ghost" size="icon" aria-label={`Take attendance for ${group.name}`} title="Take attendance" onClick={onAttendance}>
                <ClipboardCheck />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Message ${group.name}`} title="Message group" onClick={onMessage}>
                <MessageSquare />
              </Button>
            </div>
          )}
        </div>
        <CapacityBar count={group.member_count} capacity={group.capacity} />
      </div>
      {group.members.length ? (
        <ul className="divide-y">
          {group.members.map((m) => (
            <MemberRow key={m.id} member={m} groups={groups} currentGroupId={group.id} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No members in this group.</p>
      )}
    </Card>
  )
}

export default function RosterPage() {
  const { courseId } = useParams()
  const { data, isPending, isError } = useRoster(courseId)
  const [target, setTarget] = useState(null)
  const [attendance, setAttendance] = useState(null)

  if (isError) return <p className="text-muted-foreground">Course not found.</p>
  if (isPending)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-10 w-60 md:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )

  const { course, groups, unassigned } = data
  const columns = [...groups, ...(unassigned.length ? [{ id: null, name: groups.length ? 'Unassigned' : 'Members', members: unassigned, member_count: unassigned.length }] : [])]

  return (
    <>
      <Link to="/courses" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="size-3.5" /> Courses
      </Link>
      <PageHeader title={course.name} description={[course.description, `${course.member_count} member${course.member_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <Button variant="outline" disabled={!course.member_count} onClick={() => setTarget({ course_id: course.id, name: course.name })}>
            <MessageSquare /> Message course
          </Button>
        </div>
      </PageHeader>

      {columns.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No members yet" description="Members enrolled in this course appear here, grouped by their group." />
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 print:block print:columns-2 print:[&>*]:mb-4">
          {columns.map((g) => (
            <GroupCard key={g.id ?? 'none'} group={g} groups={groups} onMessage={() => setTarget({ group_id: g.id, name: `${course.name} · ${g.name}` })} onAttendance={() => setAttendance(g)} />
          ))}
        </div>
      )}

      <AttendanceDialog group={attendance} onOpenChange={(o) => !o && setAttendance(null)} />
      <SendMessageDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        target={target && (target.group_id ? { group_id: target.group_id } : { course_id: target.course_id })}
        title={`Message ${target?.name ?? ''}`}
        description="Sent to every current member with a contact for the chosen channel."
      />
    </>
  )
}
