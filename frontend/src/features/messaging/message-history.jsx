import { Mail, MessageCircle, MessageSquare, RotateCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { date } from '@/lib/format'

import { CHANNEL_LABELS, useMessages, useRetryMessage } from './api'

const ICONS = { email: Mail, sms: MessageSquare, whatsapp: MessageCircle }
const KIND = {
  reminder: 'Reminder',
  invoice: 'Invoice',
  announcement: 'Message',
}
const TONE = { sent: 'success', failed: 'danger', manual: 'neutral' }
const STATUS = { sent: 'Sent', failed: 'Failed', manual: 'From device' }

export function MessageHistory({ memberId }) {
  const { data } = useMessages({ member_id: memberId, size: 20 }, { placeholderData: undefined })
  const retry = useRetryMessage()
  if (!data) return null
  if (!data.items.length) return <p className="text-[13px] text-muted-foreground">No messages yet.</p>
  return (
    <ul className="divide-y rounded-lg border">
      {data.items.map((m) => {
        const Icon = ICONS[m.channel]
        return (
          <li key={m.id} className="flex gap-3 px-3 py-2.5 text-[13px]">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={CHANNEL_LABELS[m.channel]} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{KIND[m.kind]}</span>
                <Badge tone={TONE[m.status]}>{STATUS[m.status]}</Badge>
              </div>
              {m.body && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{m.body}</p>}
              {m.error && <p className="mt-0.5 text-xs text-danger">{m.error}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {date(m.sent_at)}
                {m.recipient && ` · ${m.recipient}`}
              </p>
            </div>
            {m.status === 'failed' && (
              <Button size="icon" variant="ghost" aria-label="Retry" title="Retry" disabled={retry.isPending} onClick={() => retry.mutate(m.id)}>
                <RotateCw />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
