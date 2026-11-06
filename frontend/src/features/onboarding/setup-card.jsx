import { ArrowRight, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMe } from '@/features/auth/api'

import { useDismissOnboarding, useSetupPending } from './api'
import { Progress } from './progress'
import { STEPS } from './steps'

/** Dashboard nudge with the next few setup steps; links to the full guide. */
export function SetupCard() {
  const data = useSetupPending()
  const { data: me } = useMe()
  const dismiss = useDismissOnboarding()
  if (!data) return null
  const next = data.steps.filter((s) => !s.done && !s.optional).slice(0, 3)

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div className="grid gap-0.5">
          <h2 className="font-medium">Finish setting up</h2>
          <p className="text-[13px] text-muted-foreground">
            {data.completed} of {data.total} steps done. Each one ticks itself off once it is in place.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/getting-started" className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[13px] font-medium text-accent hover:bg-muted">
            Open guide <ArrowRight className="size-3.5" />
          </Link>
          {me?.role === 'admin' && (
            <Button variant="ghost" size="icon" aria-label="Hide setup checklist" title="Hide (reopen it from the guide)" onClick={() => dismiss.mutate(true)}>
              <X />
            </Button>
          )}
        </div>
      </div>
      <div className="px-5 pt-3 pb-4">
        <Progress value={data.completed} max={data.total} />
      </div>
      <ul className="grid border-t sm:grid-cols-3 sm:divide-x">
        {next.map((step) => {
          const { icon: Icon, title, action } = STEPS[step.id]
          return (
            <li key={step.id}>
              <Link to={action[1]} className="group flex h-full items-center gap-3 px-5 py-3 hover:bg-surface">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-[13px] font-medium">{title}</span>
                <ArrowRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          )
        })}
      </ul>
      {data.steps.some((s) => s.done) && (
        <p className="flex items-center gap-1.5 border-t bg-surface px-5 py-2 text-xs text-muted-foreground">
          <Check className="size-3.5 text-success" />
          Done: {data.steps.filter((s) => s.done).map((s) => STEPS[s.id].title.toLowerCase()).join(', ')}
        </p>
      )}
    </Card>
  )
}
