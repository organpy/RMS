import * as D from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Plus, Receipt, Rocket, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDebounced } from '@/hooks/use-debounced'
import { api } from '@/lib/api'

import { NAV } from './nav'

const item =
  'flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] select-none data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground'
const group = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground'

export function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim(), 200)
  const members = useQuery({
    queryKey: ['members', 'palette', q],
    queryFn: () => api.get('/members', { q, size: 6 }),
    enabled: open && q.length > 1,
    placeholderData: undefined,
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const go = (to) => {
    onOpenChange(false)
    setSearch('')
    navigate(to)
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <D.Content className="fixed top-[15vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl outline-none">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search members, pages and actions</D.Description>
          <Command shouldFilter={!q || q.length < 2} loop>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search members or jump to…"
              className="h-12 w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="py-8 text-center text-[13px] text-muted-foreground">No results</Command.Empty>
              {members.data?.items.length > 0 && (
                <Command.Group heading="Members" className={group}>
                  {members.data.items.map((m) => (
                    <Command.Item key={m.id} value={`member-${m.id}`} className={item} onSelect={() => go(`/members?open=${m.id}`)}>
                      <User /> {m.full_name}
                      <span className="ml-auto text-xs text-muted-foreground">{m.course_name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Actions" className={group}>
                <Command.Item className={item} onSelect={() => go('/members?new=1')}>
                  <Plus /> New member
                </Command.Item>
                <Command.Item className={item} onSelect={() => go('/payments?new=1')}>
                  <Receipt /> Record payment
                </Command.Item>
                <Command.Item className={item} onSelect={() => go('/getting-started')}>
                  <Rocket /> Getting started guide
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Go to" className={group}>
                {NAV.map(({ to, label, icon: Icon }) => (
                  <Command.Item key={to} className={item} onSelect={() => go(to)}>
                    <Icon /> {label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
