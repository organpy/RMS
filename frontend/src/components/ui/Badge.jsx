const variants = {
  default: 'bg-muted text-foreground',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-300',
  info: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
