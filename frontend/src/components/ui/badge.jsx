import { cn } from '@/lib/cn'

const tones = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

export function Badge({ tone = 'neutral', className, ...props }) {
  return (
    <span
      className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap', tones[tone], className)}
      {...props}
    />
  )
}
