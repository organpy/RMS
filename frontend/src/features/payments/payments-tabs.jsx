import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/cn'

const TABS = [
  ['/payments', 'All payments', true],
  ['/payments/daily', 'Daily report'],
]

export function PaymentsTabs() {
  return (
    <nav aria-label="Payments views" className="mb-4 flex w-fit gap-1 rounded-md bg-muted p-1 print:hidden">
      {TABS.map(([to, label, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('flex h-7 items-center rounded px-3 text-[13px] text-muted-foreground', isActive && 'bg-background font-medium text-foreground shadow-sm')}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
