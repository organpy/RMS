import { cn } from '@/lib/cn'

const variants = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent/90',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline: 'border bg-background hover:bg-muted',
  ghost: 'hover:bg-muted',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

const sizes = {
  sm: 'h-8 px-3 gap-1.5 text-[13px]',
  md: 'h-9 px-3.5 gap-2',
  icon: 'size-8',
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
