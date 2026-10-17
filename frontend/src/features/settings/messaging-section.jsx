import { Check, Send, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { CHANNEL_LABELS, useMessagingStatus, useTestMessage } from '@/features/messaging/api'
import { cn } from '@/lib/cn'

import { Section } from './section'

const ENV = { email: 'RMS_SMTP_HOST, RMS_SMTP_FROM', sms: 'RMS_TWILIO_SID, RMS_TWILIO_TOKEN, RMS_TWILIO_SMS_FROM', whatsapp: 'RMS_TWILIO_SID, RMS_TWILIO_TOKEN, RMS_TWILIO_WHATSAPP_FROM' }

export function MessagingSection() {
  const { data: status } = useMessagingStatus()
  const test = useTestMessage()
  const connected = Object.keys(CHANNEL_LABELS).filter((c) => status?.[c])
  const [form, setForm] = useState({ channel: '', to: '' })
  const channel = form.channel || connected[0]

  return (
    <Section id="messaging" title="Messaging" description="Email goes through your SMTP server, SMS and WhatsApp through Twilio. Credentials live in the .env file next to the app, never in the database.">
      <div className="grid gap-5">
        <ul className="divide-y rounded-lg border text-[13px]">
          {Object.entries(CHANNEL_LABELS).map(([c, label]) => (
            <li key={c} className="flex items-center gap-3 px-3 py-2.5">
              <span className={cn('grid size-5 place-items-center rounded-full', status?.[c] ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                {status?.[c] ? <Check className="size-3" /> : <X className="size-3" />}
              </span>
              <span className="font-medium">{label}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{status?.[c] ? 'Connected' : `Set ${ENV[c]}`}</span>
            </li>
          ))}
        </ul>
        {connected.length > 0 && (
          <form
            className="grid grid-cols-[8rem_1fr_auto] items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              test.mutate({ channel, to: form.to })
            }}
          >
            <Field label="Test channel">
              <Select value={channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                {connected.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Send to">
              <Input required value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} placeholder={channel === 'email' ? 'you@example.com' : '+15551234567'} />
            </Field>
            <Button type="submit" variant="outline" disabled={test.isPending}>
              <Send /> Send test
            </Button>
          </form>
        )}
      </div>
    </Section>
  )
}
