import { NavLink } from 'react-router-dom'
import { NAVIGATION } from '../../utils/navigation'
import Badge from '../ui/Badge'
import { useBusiness } from '../../context/BusinessContext'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Sidebar() {
  const { business } = useBusiness()

  return (
    <aside className="hidden w-72 flex-shrink-0 flex-col border-r border-slate-200 bg-white px-6 py-8 lg:flex">
      <div className="mb-8 space-y-2">
        {business?.logo_path ? (
          <img
            src={business.logo_path}
            alt={`${business.name} logo`}
            className="h-12 w-auto"
          />
        ) : (
          <div className="text-2xl font-semibold text-secondary">{business?.name ?? 'Your Business'}</div>
        )}
        <Badge variant="info" className="uppercase tracking-wide">
          Admin Console
        </Badge>
      </div>
      <nav className="flex-1 space-y-1 text-sm font-medium text-slate-600">
        {NAVIGATION.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                'flex items-center rounded-xl px-4 py-3 transition hover:bg-primary/10 hover:text-primary',
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600',
              )
            }
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto text-xs text-slate-400">
        <p>{business?.currency ?? 'USD'} • {business?.language ?? 'EN'}</p>
        <p className="mt-1">Offline-first dashboard experience</p>
      </div>
    </aside>
  )
}
