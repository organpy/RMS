import { Search, X } from 'lucide-react'
import { useState } from 'react'

import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { useMembers } from '@/features/members/api'
import { useDebounced } from '@/hooks/use-debounced'

export function MemberPicker({ value, onChange }) {
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim(), 200)
  const { data } = useMembers({ q, size: 6 })

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{[value.course_name, value.plan_name].filter(Boolean).join(' · ') || 'No plan'}</p>
        </div>
        <StatusBadge status={value.status} />
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => onChange(null)} aria-label="Change member">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members" className="pl-9" />
      </div>
      <ul className="max-h-56 overflow-y-auto rounded-md border">
        {data?.items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onChange(m)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted">
              <span className="min-w-0 flex-1 truncate">{m.full_name}</span>
              <span className="truncate text-xs text-muted-foreground">{m.course_name}</span>
            </button>
          </li>
        ))}
        {data?.items.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-muted-foreground">No members found</li>}
      </ul>
    </div>
  )
}
