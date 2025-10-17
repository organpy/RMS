const variants = {
  default: 'bg-secondary/10 text-secondary',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-primary/10 text-primary',
  secondary: 'bg-slate-200 text-slate-700',
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
