export function normalizeMemberStatus(status) {
  const normalized = (status ?? '').toString().toUpperCase()
  return ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(normalized) ? normalized : 'ACTIVE'
}

export function formatStatusDisplay(status, count) {
  switch (status) {
    case 'ACTIVE':
      return `active member${count === 1 ? '' : 's'}`
    case 'INACTIVE':
      return `inactive member${count === 1 ? '' : 's'}`
    case 'SUSPENDED':
      return `suspended member${count === 1 ? '' : 's'}`
    default:
      return `member${count === 1 ? '' : 's'}`
  }
}

export function badgeVariantForStatus(status) {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'success'
    case 'INACTIVE':
      return 'secondary'
    case 'SUSPENDED':
      return 'warning'
    default:
      return 'info'
  }
}

export function resolveMemberRowClassName(member, today) {
  const status = (member.status ?? '').toUpperCase()
  if (status === 'INACTIVE') {
    return 'bg-slate-50'
  }
  if (status === 'SUSPENDED') {
    return 'bg-amber-50/60'
  }

  if (member.next_payment_due) {
    const dueDate = new Date(member.next_payment_due)
    if (!Number.isNaN(dueDate.getTime())) {
      const normalizedDue = new Date(dueDate)
      normalizedDue.setHours(0, 0, 0, 0)
      if (normalizedDue < today) {
        return 'bg-rose-50/80'
      }
    }
  }

  return ''
}

export function formatMemberDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return parsed.toLocaleDateString()
}
