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
  ...rest
}) {
  return (
    <section className={cx('rounded-2xl border border-border bg-card p-8 shadow-sm', className)} {...rest}>
      {(title || subtitle || header) && (
        <div className="mb-6 flex flex-col gap-2">
          {header ?? (
            <>
              {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </>
          )}
        </div>
      )}
      <div className="space-y-5 text-sm text-foreground/90">{children}</div>
      {footer && <div className="mt-8 border-t border-border pt-5 text-sm text-muted-foreground">{footer}</div>}
    </section>
  )
}
