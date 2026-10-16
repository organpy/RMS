import { Send } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'

import { CHANNEL_LABELS, useMessagingStatus, useSendMessages } from './api'

const PLACEHOLDERS = '{first_name} {last_name} {plan} {amount} {due_date} {organization}'

function SendForm({ target, onDone }) {
  const { data: status = {} } = useMessagingStatus()
  const channels = Object.keys(CHANNEL_LABELS).filter((c) => status[c])
  const send = useSendMessages()
  const [form, setForm] = useState({
    channel: channels[0] ?? 'email',
    kind: 'announcement',
    subject: '',
    body: '',
  })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  if (!channels.length)
    return (
      <p className="text-[13px] text-muted-foreground">
        No channel is connected. Add SMTP or Twilio settings to <code>.env</code> and restart. See{' '}
        <Link to="/settings#messaging" className="underline" onClick={onDone}>
          Settings
        </Link>
        .
      </p>
    )

  const submit = (e) => {
    e.preventDefault()
    const body = form.kind === 'reminder' ? {} : { body: form.body, subject: form.subject || undefined }
    send.mutate({ ...target, channel: form.channel, kind: form.kind, ...body }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <Select value={form.channel} onChange={set('channel')}>
            {channels.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={form.kind} onChange={set('kind')}>
            <option value="announcement">Message</option>
            <option value="reminder">Payment reminder</option>
          </Select>
        </Field>
      </div>
      {form.kind === 'reminder' ? (
        <p className="rounded-lg bg-muted p-3 text-[13px] text-muted-foreground">Uses the reminder template from Settings, personalised for each member.</p>
      ) : (
        <>
          {form.channel === 'email' && (
            <Field label="Subject">
              <Input value={form.subject} onChange={set('subject')} maxLength={200} placeholder="Defaults to your organization name" />
            </Field>
          )}
          <Field label="Message" hint={`Placeholders: ${PLACEHOLDERS}`}>
            <Textarea rows={5} required maxLength={2000} value={form.body} onChange={set('body')} />
          </Field>
        </>
      )}
      <DialogFooter>
        <Button type="submit" disabled={send.isPending}>
          <Send /> {send.isPending ? 'Sending…' : 'Send'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Compose a message to members, a course or a group. `target` is {member_ids} | {course_id} | {group_id}. */
export function SendMessageDialog({ open, onOpenChange, target, title = 'Send message', description }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {open && <SendForm target={target} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
