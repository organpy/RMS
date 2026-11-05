import { ChevronRight, ChevronsUpDown, Keyboard, LogOut, Menu as MenuIcon, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown'
import { useLogout, useMe } from '@/features/auth/api'
import { useStored } from '@/hooks/use-stored'
import { useLogoVersion, useOrg } from '@/features/organization/api'
import { cn } from '@/lib/cn'
import { configureFormat, initials } from '@/lib/format'
import { applyBrand, applyMode, getMode } from '@/lib/theme'

import { CommandPalette } from './command-palette'
import { SECTIONS } from './nav'
import { ShortcutsDialog, useShortcuts } from './shortcuts'

function OrgMark({ org }) {
  const version = useLogoVersion()
  if (org?.has_logo) return <img src={`/api/organization/logo?v=${version}`} alt="" className="size-7 rounded-md object-contain" />
  return (
    <div className="grid size-7 place-items-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
      {initials(org?.name ?? 'R')}
    </div>
  )
}

function NavItem({ to, label, icon: Icon, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0',
          collapsed && 'justify-center px-0',
          isActive && 'bg-muted font-medium text-foreground',
        )
      }
    >
      <Icon /> {!collapsed && label}
    </NavLink>
  )
}

function Nav({ onNavigate, collapsed }) {
  const [closed, setClosed] = useStored('rms-nav-closed', [])
  const { pathname } = useLocation()
  const toggle = (id) => setClosed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  return (
    <nav className="grid gap-3 overflow-y-auto">
      {SECTIONS.map(({ id, label, items }) => {
        const active = items.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))
        const open = collapsed || !label || !closed.includes(id) || active
        return (
          <div key={id} className="grid gap-0.5">
            {label &&
              (collapsed ? (
                <div className="mx-2 mb-1 border-t" />
              ) : (
                <button
                  onClick={() => toggle(id)}
                  aria-expanded={open}
                  className="group flex h-6 items-center gap-1 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {label}
                  <ChevronRight className={cn('size-3 transition', open ? 'rotate-90 opacity-0 group-hover:opacity-100' : 'opacity-100')} />
                </button>
              ))}
            {open && items.map((item) => <NavItem key={item.to} {...item} collapsed={collapsed} onNavigate={onNavigate} />)}
          </div>
        )
      })}
    </nav>
  )
}

function UserMenu({ collapsed, onShortcuts }) {
  const { data: me } = useMe()
  const logout = useLogout()
  const [mode, setMode] = useState(getMode)
  const modes = [
    ['light', 'Light', Sun],
    ['dark', 'Dark', Moon],
    ['system', 'System', Monitor],
  ]
  return (
    <Menu>
      <MenuTrigger
        title={collapsed ? me?.name : undefined}
        className={cn('flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-muted', collapsed && 'justify-center p-1.5')}
      >
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{initials(me?.name)}</div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{me?.name}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{me?.role}</p>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </MenuTrigger>
      <MenuContent align="start" className="w-52">
        <MenuLabel>Appearance</MenuLabel>
        {modes.map(([value, label, Icon]) => (
          <MenuItem
            key={value}
            onSelect={(e) => {
              e.preventDefault()
              applyMode(value)
              setMode(value)
            }}
          >
            <Icon /> {label}
            {mode === value && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={onShortcuts}>
          <Keyboard /> Keyboard shortcuts
          <kbd className="ml-auto font-sans text-xs text-muted-foreground">?</kbd>
        </MenuItem>
        <MenuItem onSelect={() => logout.mutate()}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

function SearchButton({ onClick, collapsed }) {
  if (collapsed)
    return (
      <button onClick={onClick} title="Search (⌘K)" aria-label="Search" className="grid h-8 w-full place-items-center rounded-md border bg-background text-muted-foreground hover:bg-muted">
        <Search className="size-4" />
      </button>
    )
  return (
    <button onClick={onClick} className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2.5 text-[13px] text-muted-foreground hover:bg-muted">
      <Search className="size-4" /> Search…
      <kbd className="ml-auto font-sans text-xs">⌘K</kbd>
    </button>
  )
}

const typing = (el) => el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName)

export function Layout() {
  const { data: org } = useOrg()
  const [palette, setPalette] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [collapsed, setCollapsed] = useStored('rms-sidebar-collapsed', false)
  const { pathname } = useLocation()
  const toggle = () => setCollapsed((c) => !c)
  const [help, setHelp] = useState(false)
  const showHelp = useCallback(() => setHelp(true), [])
  useShortcuts(showHelp)

  useEffect(() => {
    if (!org) return
    applyBrand(org.primary_color)
    configureFormat(org)
    document.title = `${org.name} · RMS`
  }, [org])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      e.preventDefault()
      setCollapsed((c) => !c)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCollapsed])

  return (
    <div className="min-h-dvh">
      <aside
        className={cn(
          'fixed inset-y-0 z-30 hidden flex-col gap-4 overflow-x-hidden border-r bg-surface p-3 transition-[width] duration-200 print:hidden lg:flex',
          collapsed ? 'w-14 px-2' : 'w-60',
        )}
      >
        <div className={cn('flex items-center gap-2.5 pt-1', collapsed ? 'justify-center' : 'px-1.5')}>
          <OrgMark org={org} />
          {!collapsed && <span className="truncate font-semibold">{org?.name}</span>}
        </div>
        <SearchButton collapsed={collapsed} onClick={() => setPalette(true)} />
        <Nav collapsed={collapsed} />
        <div className="mt-auto grid gap-1">
          <button
            onClick={toggle}
            title={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!collapsed && (
              <>
                Collapse
                <kbd className="ml-auto font-sans text-xs">[</kbd>
              </>
            )}
          </button>
          <UserMenu collapsed={collapsed} onShortcuts={showHelp} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 print:hidden items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileNav(true)} aria-label="Open menu">
          <MenuIcon />
        </Button>
        <OrgMark org={org} />
        <span className="truncate font-semibold">{org?.name}</span>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setPalette(true)} aria-label="Search">
          <Search />
        </Button>
      </header>
      <Sheet open={mobileNav} onOpenChange={setMobileNav} title={org?.name ?? 'Menu'}>
        <div className="flex h-full flex-col gap-4">
          <Nav onNavigate={() => setMobileNav(false)} />
          <div className="mt-auto">
            <UserMenu onShortcuts={showHelp} />
          </div>
        </div>
      </Sheet>

      <div className={cn('transition-[padding] duration-200 print:pl-0', collapsed ? 'lg:pl-14' : 'lg:pl-60')}>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 print:max-w-none print:p-0">
          <Suspense>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </div>
  )
}
