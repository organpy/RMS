import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

const overlay = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'

export function DialogContent({ title, description, className, children }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid outline-none max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="grid gap-1 pr-6">
          <D.Title className="text-base font-semibold">{title}</D.Title>
          <D.Description className={cn('text-[13px] text-muted-foreground', !description && 'sr-only')}>
            {description || title}
          </D.Description>
        </div>
        {children}
        <D.Close className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  )
}

export function Sheet({ open, onOpenChange, title, description, children }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content onOpenAutoFocus={(e) => e.preventDefault()} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right">
          <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="grid gap-0.5">
              <D.Title className="text-base font-semibold">{title}</D.Title>
              <D.Description className={cn('text-[13px] text-muted-foreground', !description && 'sr-only')}>
                {description || title}
              </D.Description>
            </div>
            <D.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export function DialogFooter({ children }) {
  return <div className="flex justify-end gap-2 pt-1">{children}</div>
}
