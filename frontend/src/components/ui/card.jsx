import { cn } from '@/lib/cn'

export function Card({ className, ...props }) {
  return <section className={cn('rounded-xl border bg-background', className)} {...props} />
}

export function CardHeader({ title, description, action, className }) {
  return (
    <header className={cn('flex items-start justify-between gap-4 px-5 pt-4 pb-3', className)}>
      <div className="grid gap-0.5">
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  )
}
