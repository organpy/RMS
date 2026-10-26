import { Download, Plus, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { EmptyState, PageHeader } from '@/components/page'
import { Pagination } from '@/components/pagination'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { useCourses } from '@/features/courses/api'
import { useDebounced } from '@/hooks/use-debounced'
import { useParamsState } from '@/hooks/use-params-state'
import { download } from '@/lib/download'
import { date, money } from '@/lib/format'

import { useMembers } from './api'
import { MemberFormDialog } from './member-form'
import { MemberSheet } from './member-sheet'

const SIZE = 25
const STATUSES = [
  ['', 'All current'],
  ['active', 'Active'],
  ['due', 'Due'],
  ['overdue', 'Overdue'],
  ['archived', 'Archived'],
]

export default function MembersPage() {
  const [params, patch] = useParamsState()
  const [search, setSearch] = useState(params.q ?? '')
  const q = useDebounced(search.trim())
  const { data: courses = [] } = useCourses()
  const page = Number(params.page ?? 1)
  const filters = { q, status: params.status, course_id: params.course_id, group_id: params.group_id, sort: params.sort }
  const { data, isPending } = useMembers({ ...filters, page, size: SIZE })
  const groups = courses.find((c) => String(c.id) === params.course_id)?.groups ?? []

  useEffect(() => {
    if (q !== (params.q ?? '')) patch({ q, page: null })
  }, [q, params.q, patch])

  const filtered = Boolean(q || params.status || params.course_id)
  const sortBy = (key) => patch({ sort: params.sort === key ? `-${key}` : key, page: null })

  return (
    <>
      <PageHeader title="Members" description={data ? `${data.total.toLocaleString()} ${filtered ? 'matching' : 'current'} members` : ' '}>
        <Button variant="outline" onClick={() => download('/members/export.csv', filters, 'members.csv')}>
          <Download /> Export
        </Button>
        <Button onClick={() => patch({ new: 1 })}>
          <Plus /> New member
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="pl-9" />
        </div>
        <Select className="w-36" value={params.status ?? ''} onChange={(e) => patch({ status: e.target.value, page: null })} aria-label="Status">
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select className="w-40" value={params.course_id ?? ''} onChange={(e) => patch({ course_id: e.target.value, group_id: null, page: null })} aria-label="Course">
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {groups.length > 0 && (
          <Select className="w-36" value={params.group_id ?? ''} onChange={(e) => patch({ group_id: e.target.value, page: null })} aria-label="Group">
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card>
        {isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={Users} title={filtered ? 'No matching members' : 'No members yet'} description={filtered ? 'Try a different search or filter.' : 'Add your first member to start tracking payments.'}>
            {!filtered && <Button onClick={() => patch({ new: 1 })}>New member</Button>}
          </EmptyState>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <button onClick={() => sortBy('name')}>Name</button>
                  </TH>
                  <TH className="hidden md:table-cell">Course</TH>
                  <TH className="hidden sm:table-cell">Plan</TH>
                  <TH className="hidden sm:table-cell">
                    <button onClick={() => sortBy('paid_until')}>Paid until</button>
                  </TH>
                  <TH className="text-right">Status</TH>
                </TR>
              </THead>
              <tbody>
                {data.items.map((m) => (
                  <TR key={m.id} className="cursor-pointer hover:bg-surface" onClick={() => patch({ open: m.id })}>
                    <TD>
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.email ?? m.phone}</p>
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{[m.course_name, m.group_name].filter(Boolean).join(' · ') || '—'}</TD>
                    <TD className="hidden text-muted-foreground sm:table-cell">{m.plan_name ?? '—'}</TD>
                    <TD className="hidden whitespace-nowrap tabular sm:table-cell">{date(m.paid_until)}</TD>
                    <TD className="text-right">
                      <StatusBadge status={m.status} />
                      {m.balance > 0 && <span className="mt-0.5 block text-xs text-danger">owes {money(m.balance)}</span>}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} size={SIZE} total={data.total} onPage={(p) => patch({ page: p })} />
          </>
        )}
      </Card>

      <MemberFormDialog open={!!params.new} onOpenChange={(o) => !o && patch({ new: null })} onSaved={(m) => patch({ open: m.id })} />
      <MemberSheet memberId={params.open ? Number(params.open) : null} onClose={() => patch({ open: null })} />
    </>
  )
}
