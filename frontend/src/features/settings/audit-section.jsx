import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Pagination } from '@/components/pagination'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/input'
import { api } from '@/lib/api'
import { date } from '@/lib/format'

import { Section } from './section'

const SIZE = 15
const ENTITIES = ['member', 'payment', 'expense', 'plan', 'course', 'group', 'staff', 'settings', 'backup']
const TONE = { created: 'success', deleted: 'danger', refunded: 'danger', archived: 'warning' }
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

export function AuditSection() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const { data } = useQuery({ queryKey: ['audit', entity, page], queryFn: () => api.get('/audit', { entity, page, size: SIZE }) })

  return (
    <Section id="audit" title="Activity log" description="Who changed what, newest first. Entries are kept even if the staff account is later removed.">
      <div className="grid gap-3">
        <Select className="w-44" value={entity} onChange={(e) => (setEntity(e.target.value), setPage(1))} aria-label="Filter by type">
          <option value="">All activity</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e[0].toUpperCase() + e.slice(1)}
            </option>
          ))}
        </Select>
        <div className="rounded-lg border">
          {data && data.items.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No activity yet.</p>}
          <ul className="divide-y">
            {data?.items.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge tone={TONE[a.action]}>{a.action}</Badge>
                    <span className="text-muted-foreground capitalize">{a.entity}</span>
                  </p>
                  <p className="mt-1 break-words">{a.summary || '—'}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{a.staff_name}</p>
                  <p className="tabular">
                    {date(a.at)} · {time(a.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {data && <Pagination page={page} size={SIZE} total={data.total} onPage={setPage} />}
        </div>
      </div>
    </Section>
  )
}
