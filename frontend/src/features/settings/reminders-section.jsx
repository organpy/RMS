import { Field, Textarea } from '@/components/ui/input'

import { SaveBar, useOrgForm } from './organization-section'
import { Section } from './section'

const PLACEHOLDERS = ['first_name', 'last_name', 'plan', 'amount', 'due_date', 'organization']

export function RemindersSection({ org }) {
  const form = useOrgForm(org, ['reminder_template'])
  return (
    <Section id="reminders" title="Reminder message" description="Prefilled when you send a reminder by email, SMS or WhatsApp.">
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
        <SaveBar form={form} />
      </form>
    </Section>
  )
}
