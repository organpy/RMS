export function Section({ id, title, description, children }) {
  return (
    <section id={id} className="grid scroll-mt-8 gap-6 border-b py-8 first:pt-0 last:border-0 grid-cols-[minmax(0,1fr)] md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
