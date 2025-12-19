import { NavLink } from 'react-router-dom'
import { NAVIGATION } from '../../utils/navigation'
import Badge from '../ui/Badge'
import { useBusiness } from '../../context/BusinessContext'
import { prefetchRoute } from '../../routes/prefetchRoutes'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Sidebar() {
  const { business } = useBusiness()

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-card px-5 py-6 lg:flex">
      <div className="mb-8 space-y-2">
        {business?.logo_path ? (
          <img
            src={business.logo_path}
            alt={`${business.name} logo`}
            className="h-12 w-auto"
          />
        ) : (
          <div className="text-lg font-semibold text-foreground">{business?.name ?? 'Your Business'}</div>
        )}
        <Badge variant="info" className="uppercase tracking-wide">
          Admin Console
        </Badge>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm font-medium text-muted-foreground">
        {NAVIGATION.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onMouseEnter={() => prefetchRoute(item.to)}
            onFocus={() => prefetchRoute(item.to)}
            className={({ isActive }) =>
              cx(
                'flex items-center rounded-xl px-3 py-2.5 transition hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )
            }
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto text-xs text-muted-foreground">
        <p>
          {business?.currency ?? 'USD'} • {business?.language ?? 'EN'}
        </p>
        <p className="mt-1">Offline-first dashboard experience</p>
      </div>
    </aside>
  )
}
