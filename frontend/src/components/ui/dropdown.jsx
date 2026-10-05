import * as M from '@radix-ui/react-dropdown-menu'

import { cn } from '@/lib/cn'

export const Menu = M.Root
export const MenuTrigger = M.Trigger

export function MenuContent({ className, align = 'end', ...props }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 min-w-44 rounded-lg border bg-background p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)}
        {...props}
      />
    </M.Portal>
  )
}

export function MenuItem({ className, danger, ...props }) {
  return (
    <M.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground',
        danger && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />

export function MenuLabel(props) {
  return <M.Label className="px-2 py-1.5 text-xs text-muted-foreground" {...props} />
}
