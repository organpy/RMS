import './index.css'

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary/5 px-6 py-16 text-center">
      <div className="max-w-2xl space-y-6">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm font-medium uppercase tracking-wide text-primary">
          Phase 0 Scaffolding
        </span>
        <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
          Registration Management System
        </h1>
        <p className="text-lg text-slate-600">
          The React frontend is ready for feature development. Replace this
          placeholder with the dashboard layout in Phase 5 and wire it to the
          backend APIs as they become available.
        </p>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-left shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">
            Next steps
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Implement routing and shared layout components.</li>
            <li>Connect to the FastAPI backend once endpoints are available.</li>
            <li>Replace this message with the real dashboard experience.</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

export default App
