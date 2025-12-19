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
    <section className={cx('rounded-2xl border border-border bg-card p-5 shadow-sm', className)}>
      {(title || subtitle || header) && (
        <div className="mb-4 flex flex-col gap-1">
          {header ?? (
            <>
              {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </>
          )}
        </div>
      )}
      <div className="space-y-4 text-sm text-foreground/90">{children}</div>
      {footer && <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">{footer}</div>}
    </section>
  )
}
