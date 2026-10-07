import { Badge } from '@/components/ui/badge'

const STATUS = {
  active: ['success', 'Active'],
  due: ['warning', 'Due'],
  overdue: ['danger', 'Overdue'],
  archived: ['neutral', 'Archived'],
  refunded: ['neutral', 'Refunded'],
}

export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] ?? ['neutral', status]
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  )
}
