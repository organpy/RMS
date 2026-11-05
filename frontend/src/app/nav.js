import { BellRing, BookOpen, ChartLine, LayoutDashboard, Receipt, Settings, Tags, Users, Wallet } from 'lucide-react'

export const SECTIONS = [
  { id: 'overview', label: null, items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }, { to: '/analytics', label: 'Analytics', icon: ChartLine }] },
  {
    id: 'people',
    label: 'People',
    items: [
      { to: '/members', label: 'Members', icon: Users },
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/reminders', label: 'Reminders', icon: BellRing },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { to: '/payments', label: 'Payments', icon: Receipt },
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/plans', label: 'Plans', icon: Tags },
    ],
  },
  { id: 'system', label: 'System', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]

export const NAV = SECTIONS.flatMap((s) => s.items)
