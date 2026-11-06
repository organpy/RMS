import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/page'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/api'
import { cn } from '@/lib/cn'

import { useDismissOnboarding, useOnboarding } from './api'
import { Progress } from './progress'
import { STEPS } from './steps'

function Step({ index, step, admin }) {
  const { icon: Icon, title, body, action, secondary } = STEPS[step.id]
  const locked = STEPS[step.id].admin && !admin
  return (
    <li className="flex gap-4 px-5 py-4">
      <div
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium tabular',
          step.done ? 'border-transparent bg-success/10 text-success' : 'text-muted-foreground',
        )}
      >
        {step.done ? <Check className="size-4" /> : index + 1}
      </div>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className={cn('font-medium', step.done && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{title}</h2>
          {step.optional && <Badge>Optional</Badge>}
        </div>
        <p className="max-w-prose text-[13px] text-muted-foreground">{body}</p>
        {locked ? (
          <p className="text-xs text-muted-foreground">Ask an admin to do this step.</p>
        ) : (
          !step.done && (
            <div className="mt-1 flex flex-wrap gap-2">
              <Link to={action[1]} className={buttonClass({ size: 'sm', variant: 'outline' })}>
                {action[0]}
              </Link>
              {secondary && (
                <Link to={secondary[1]} className="flex h-8 items-center px-2 text-[13px] text-muted-foreground hover:text-foreground">
                  {secondary[0]}
                </Link>
              )}
            </div>
          )
        )}
      </div>
    </li>
  )
}

export default function GuidePage() {
  const { data: me } = useMe()
  const { data } = useOnboarding()
  const dismiss = useDismissOnboarding()
  const admin = me?.role === 'admin'
  const required = data?.steps.filter((s) => !s.optional) ?? []
  const ready = required.length > 0 && required.every((s) => s.done)

  return (
    <>
      <PageHeader title="Getting started" description="A short path from a fresh install to your first invoice. Steps tick themselves off as you go.">
        {admin && data && (
          <Button variant="outline" onClick={() => dismiss.mutate(!data.dismissed)}>
            {data.dismissed ? 'Show on dashboard' : 'Hide from dashboard'}
          </Button>
        )}
      </PageHeader>
      {!data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid max-w-3xl gap-4">
          <Card className="grid gap-3 p-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium">{ready ? 'You are all set' : `${data.completed} of ${data.total} done`}</p>
              <p className="text-[13px] text-muted-foreground">{ready ? 'The optional steps can wait.' : 'Required steps first, optional ones any time.'}</p>
            </div>
            <Progress value={data.completed} max={data.total} />
          </Card>
          <Card>
            <ol className="divide-y">
              {data.steps.map((step, i) => (
                <Step key={step.id} index={i} step={step} admin={admin} />
              ))}
            </ol>
          </Card>
          <p className="text-[13px] text-muted-foreground">
            Tip: press <kbd className="rounded border bg-surface px-1.5 font-sans text-xs">?</kbd> any time to see keyboard shortcuts.
          </p>
        </div>
      )}
    </>
  )
}
