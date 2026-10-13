import { cloneElement, useId } from 'react'

import { cn } from '@/lib/cn'

const base =
  'w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 disabled:opacity-50 aria-invalid:border-danger'

export function Input({ className, ...props }) {
  return <input className={cn(base, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(base, 'min-h-20 py-2', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(base, 'h-9 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: CHEVRON }} {...props}>
      {children}
    </select>
  )
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

/** Labelled form row. Use ``group`` when the children are several controls (buttons, lists). */
export function Field({ label, error, hint, group, className, children }) {
  const id = useId()
  const note = `${id}-note`
  const control = group ? children : cloneElement(children, { id, 'aria-describedby': error || hint ? note : undefined, 'aria-invalid': error ? true : undefined })
  return (
    <div className={cn('grid gap-1.5', className)} {...(group && { role: 'group', 'aria-label': label })}>
      {group ? <span className="text-[13px] font-medium">{label}</span> : <label htmlFor={id} className="text-[13px] font-medium">{label}</label>}
      {control}
      {error ? (
        <span id={note} className="text-xs text-danger">
          {error}
        </span>
      ) : (
        hint && (
          <span id={note} className="text-xs text-muted-foreground">
            {hint}
          </span>
        )
      )}
    </div>
  )
}
