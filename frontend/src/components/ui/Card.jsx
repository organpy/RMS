function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Card({
  title,
  subtitle,
  children,
  className,
  header,
  footer,
}) {
  return (
    <section className={cx('rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200', className)}>
      {(title || subtitle || header) && (
        <div className="mb-4 flex flex-col gap-1">
          {header ?? (
            <>
              {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </>
          )}
        </div>
      )}
      <div className="space-y-4 text-sm text-slate-600">{children}</div>
      {footer && <div className="mt-6 pt-4 text-sm text-slate-500">{footer}</div>}
    </section>
  )
}
