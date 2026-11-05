import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { DialogContent, Dialog } from '@/components/ui/dialog'

export const GO = {
  d: ['/', 'Dashboard'],
  m: ['/members', 'Members'],
  c: ['/courses', 'Courses'],
  r: ['/reminders', 'Reminders'],
  p: ['/payments', 'Payments'],
  e: ['/expenses', 'Expenses'],
  l: ['/plans', 'Plans'],
  a: ['/analytics', 'Analytics'],
  s: ['/settings', 'Settings'],
}

const typing = (el) => el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName)

/** Two-key "g then x" navigation, "n" / "r" for the common actions and "?" for help. */
export function useShortcuts(onHelp) {
  const navigate = useNavigate()
  const pending = useRef(0)
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('[role="dialog"]')) return
      const key = e.key.toLowerCase()
      if (Date.now() - pending.current < 1200 && GO[key]) {
        pending.current = 0
        e.preventDefault()
        return navigate(GO[key][0])
      }
      pending.current = 0
      if (key === 'g') pending.current = Date.now()
      else if (e.key === '?') onHelp()
      else if (key === 'n') navigate('/members?new=1')
      else if (key === 'r') navigate('/payments?new=1')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, onHelp])
}

function Keys({ keys }) {
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <kbd key={k} className="min-w-5 rounded border bg-surface px-1.5 text-center font-sans text-xs">
          {k}
        </kbd>
      ))}
    </span>
  )
}

const GENERAL = [
  [['⌘', 'K'], 'Search members and pages'],
  [['N'], 'New member'],
  [['R'], 'Record payment'],
  [['['], 'Collapse or expand the sidebar'],
  [['?'], 'Show this list'],
]

export function ShortcutsDialog({ open, onOpenChange }) {
  const row = (keys, label) => (
    <li key={label} className="flex items-center justify-between py-1.5 text-[13px]">
      {label} <Keys keys={keys} />
    </li>
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard shortcuts" description="Work faster without leaving the keyboard." className="max-w-lg">
        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">General</h3>
            <ul className="divide-y">{GENERAL.map(([k, l]) => row(k, l))}</ul>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">Go to</h3>
            <ul className="divide-y">{Object.entries(GO).map(([k, [, label]]) => row(['G', k.toUpperCase()], label))}</ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
