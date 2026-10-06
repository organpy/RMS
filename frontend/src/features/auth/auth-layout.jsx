export function AuthLayout({ title, description, children }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <img src="/favicon.svg" alt="" className="mb-6 size-9" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 mb-6 text-muted-foreground">{description}</p>
        {children}
      </div>
    </main>
  )
}
