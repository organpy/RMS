import { ChevronsUpDown, LogOut, Menu as MenuIcon, Monitor, Moon, Search, Sun } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/dropdown'
import { useLogout, useMe } from '@/features/auth/api'
import { useLogoVersion, useOrg } from '@/features/organization/api'
import { cn } from '@/lib/cn'
import { configureFormat, initials } from '@/lib/format'
import { applyBrand, applyMode, getMode } from '@/lib/theme'

import { CommandPalette } from './command-palette'
import { NAV } from './nav'

function OrgMark({ org }) {
  const version = useLogoVersion()
  if (org?.has_logo) return <img src={`/api/organization/logo?v=${version}`} alt="" className="size-7 rounded-md object-contain" />
  return (
    <div className="grid size-7 place-items-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
      {initials(org?.name ?? 'R')}
    </div>
  )
}

function Nav({ onNavigate }) {
  return (
    <nav className="grid gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4',
              isActive && 'bg-muted font-medium text-foreground',
            )
          }
        >
          <Icon /> {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserMenu() {
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
      <MenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-muted">
        <div className="grid size-7 place-items-center rounded-full bg-muted text-xs font-medium">{initials(me?.name)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{me?.name}</p>
          <p className="truncate text-xs text-muted-foreground capitalize">{me?.role}</p>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
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
        <MenuItem onSelect={() => logout.mutate()}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

function SearchButton({ onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2.5 text-[13px] text-muted-foreground hover:bg-muted', className)}
    >
      <Search className="size-4" /> Search…
      <kbd className="ml-auto font-sans text-xs">⌘K</kbd>
    </button>
  )
}

export function Layout() {
  const { data: org } = useOrg()
  const [palette, setPalette] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!org) return
    applyBrand(org.primary_color)
    configureFormat(org)
    document.title = `${org.name} · RMS`
  }, [org])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 hidden w-60 flex-col gap-4 border-r bg-surface p-3 lg:flex">
        <div className="flex items-center gap-2.5 px-1.5 pt-1">
          <OrgMark org={org} />
          <span className="truncate font-semibold">{org?.name}</span>
        </div>
        <SearchButton onClick={() => setPalette(true)} />
        <Nav />
        <div className="mt-auto">
          <UserMenu />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
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
            <UserMenu />
          </div>
        </div>
      </Sheet>

      <div className="lg:pl-60">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <Suspense>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  )
}
