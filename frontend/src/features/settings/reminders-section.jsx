import { Field, Input, Textarea } from '@/components/ui/input'
import { useMessagingStatus } from '@/features/messaging/api'

import { SaveBar, useOrgForm } from './organization-section'
import { Section } from './section'

const PLACEHOLDERS = ['first_name', 'last_name', 'plan', 'amount', 'balance', 'due_date', 'organization']

export function RemindersSection({ org }) {
  const form = useOrgForm(org, ['reminder_template', 'auto_remind', 'remind_before_days', 'remind_after_days'])
  const { data: status } = useMessagingStatus()
  const canSend = status && Object.values(status).some(Boolean)
  return (
    <Section id="reminders" title="Reminders" description="The message members receive, and whether the app sends it on its own when a membership is about to end or has ended.">
      <form className="grid gap-3" onSubmit={form.onSubmit}>
        <Field label="Template">
          <Textarea rows={4} required {...form.register('reminder_template')} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p}
              type="button"
              className="rounded border bg-surface px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
              onClick={() => form.setValue('reminder_template', `${form.getValues('reminder_template')}{${p}}`, { shouldDirty: true })}
            >
              {`{${p}}`}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-start gap-2.5 text-[13px]">
          <input type="checkbox" className="mt-0.5 accent-accent" disabled={!canSend && !org.auto_remind} {...form.register('auto_remind')} />
          <span>
            <span className="font-medium">Send reminders automatically</span>
            <span className="block text-muted-foreground">
              {canSend ? 'Uses email when the member has an address, otherwise WhatsApp or SMS. Each period is reminded at most once before and once after it ends.' : 'Connect a messaging channel first (see Messaging).'}
            </span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <Field label="Days before end">
            <Input type="number" min={0} max={30} {...form.register('remind_before_days', { valueAsNumber: true })} />
          </Field>
          <Field label="Days after end">
            <Input type="number" min={0} max={60} {...form.register('remind_after_days', { valueAsNumber: true })} />
          </Field>
        </div>
        <SaveBar form={form} />
      </form>
    </Section>
  )
}
