import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut, Settings as SettingsIcon, User, Command as CommandIcon } from 'lucide-react'
import Button from '../ui/Button'
import { NAVIGATION } from '../../utils/navigation'
import { useAuth } from '../../context/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { toast } from '@/hooks/use-toast'
import { useBusiness } from '@/context/BusinessContext'

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { business } = useBusiness()
  const [isMobileNavOpen, setMobileNavOpen] = useState(false)
  const [isCommandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const activePage = useMemo(() => {
    const match = NAVIGATION.find((item) => item.to === location.pathname)
    return match?.name ?? 'Overview'
  }, [location.pathname])

  const userInitials = useMemo(() => {
    if (!user?.name) return 'AD'
    return user.name
      .split(' ')
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('')
  }, [user?.name])

  const handleNavigate = (path) => {
    navigate(path)
    setMobileNavOpen(false)
    setCommandOpen(false)
  }

  const handleSignIn = () => {
    toast({
      title: 'Sign-in not connected yet',
      description: 'Hook up AuthProvider.login to complete this action.',
    })
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2">
          <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
              <SheetContent side="left" className="w-80 space-y-6 sm:max-w-xs">
              <SheetHeader>
                <SheetTitle>{business?.name ?? 'Admin Console'}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {NAVIGATION.map((item) => {
                  const isActive = location.pathname === item.to
                  return (
                    <SheetClose asChild key={item.to}>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.to)}
                        className={[
                          'text-left text-sm font-medium transition-colors rounded-lg px-4 py-2',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                        ].join(' ')}
                      >
                        {item.name}
                      </button>
                    </SheetClose>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Admin</span>
            <span className="text-sm font-medium text-foreground">{activePage}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:flex"
            onClick={() => setCommandOpen(true)}
          >
            <CommandIcon className="h-4 w-4" />
            Command Menu
            <span className="ml-2 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              ⌘K
            </span>
          </Button>
          <Button as={Link} to="/settings" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Settings
          </Button>
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/50 hover:text-primary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {userInitials}
                  </span>
                  <span className="hidden text-left leading-tight sm:flex sm:flex-col">
                    <span>{user?.name ?? 'Account'}</span>
                    {user?.email ? (
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    ) : null}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{user?.name ?? 'Account'}</span>
                    {user?.email ? (
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleNavigate('/settings')}>
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                  <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => logout()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="secondary" size="sm" className="px-3" onClick={handleSignIn}>
              <User className="mr-2 h-4 w-4" />
              Sign in
            </Button>
          )}
        </div>
      </header>
      <CommandPalette open={isCommandOpen} onOpenChange={setCommandOpen} onNavigate={handleNavigate} />
    </>
  )
}

function CommandPalette({ open, onOpenChange, onNavigate }) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or search commands" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAVIGATION.map((item) => (
            <CommandItem
              key={item.to}
              value={item.name}
              onSelect={() => onNavigate(item.to)}
            >
              {item.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
