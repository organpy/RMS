import { BellRing, BookOpen, ChartLine, LayoutDashboard, Receipt, Settings, Tags, Users } from 'lucide-react'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/payments', label: 'Payments', icon: Receipt },
  { to: '/reminders', label: 'Reminders', icon: BellRing },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/plans', label: 'Plans', icon: Tags },
  { to: '/analytics', label: 'Analytics', icon: ChartLine },
  { to: '/settings', label: 'Settings', icon: Settings },
]
