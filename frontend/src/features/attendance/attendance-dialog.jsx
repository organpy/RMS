import { Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { download } from '@/lib/download'
import { today } from '@/lib/format'

import { useSaveSession, useSession } from './api'

const OPTIONS = [
  ['present', 'Present', 'bg-success/10 text-success'],
  ['late', 'Late', 'bg-warning/10 text-warning'],
  ['absent', 'Absent', 'bg-danger/10 text-danger'],
]

function Register({ groupId, day, onDone }) {
  const { data } = useSession(groupId, day)
  const save = useSaveSession(groupId)
  const [marks, setMarks] = useState({})

  if (!data) return <Skeleton className="h-48" />
  const status = (r) => marks[r.member_id] ?? r.status
  const counts = Object.fromEntries(OPTIONS.map(([v]) => [v, data.records.filter((r) => status(r) === v).length]))
  const submit = () =>
    save.mutate(
      { day, records: data.records.filter((r) => status(r)).map((r) => ({ member_id: r.member_id, status: status(r) })) },
      { onSuccess: onDone },
    )

  if (!data.records.length) return <p className="text-[13px] text-muted-foreground">This group has no members.</p>
  return (
    <>
      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span>
          {counts.present} present · {counts.late} late · {counts.absent} absent
          {data.recorded ? '' : ' · not taken yet'}
        </span>
        <button type="button" className="hover:text-foreground" onClick={() => setMarks(Object.fromEntries(data.records.map((r) => [r.member_id, 'present'])))}>
          Mark all present
        </button>
      </div>
      <ul className="-mx-6 max-h-[50vh] divide-y overflow-y-auto border-y">
        {data.records.map((r) => (
          <li key={r.member_id} className="flex items-center gap-3 px-6 py-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate font-medium">{r.full_name}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${r.full_name}`}>
              {OPTIONS.map(([value, label, tone]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={status(r) === value}
                  onClick={() => setMarks((m) => ({ ...m, [r.member_id]: value }))}
                  className={cn('h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted', status(r) === value && `${tone} font-medium hover:bg-transparent`)}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <DialogFooter>
        <Button type="button" onClick={submit} disabled={save.isPending || !data.records.some((r) => status(r))}>
          Save attendance
        </Button>
      </DialogFooter>
    </>
  )
}

export function AttendanceDialog({ group, onOpenChange }) {
  const [day, setDay] = useState(today())
  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent title={`Attendance · ${group?.name ?? ''}`} description={group?.schedule} className="max-w-lg">
        {group && (
          <>
            <div className="flex items-end gap-2">
              <Field label="Date" className="flex-1">
                <Input type="date" value={day} max={today()} required onChange={(e) => e.target.value && setDay(e.target.value)} />
              </Field>
              <Button variant="outline" onClick={() => download(`/groups/${group.id}/attendance.csv`, {}, `attendance-${group.name}.csv`)} title="Last 30 days as CSV">
                <Download /> Register
              </Button>
            </div>
            <Register key={day} groupId={group.id} day={day} onDone={() => onOpenChange(false)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
