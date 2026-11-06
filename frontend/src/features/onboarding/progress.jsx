export function Progress({ value, max }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  )
}
