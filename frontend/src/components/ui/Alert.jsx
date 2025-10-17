const variants = {
  info: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Alert({ title, description, variant = 'info', actions, className }) {
  return (
    <div className={cx('rounded-xl border px-4 py-3', variants[variant], className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {title && <p className="text-sm font-semibold">{title}</p>}
          {description && <p className="mt-1 text-sm opacity-90">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 text-sm">{actions}</div>}
      </div>
    </div>
  )
}
