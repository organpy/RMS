import { useMemo } from 'react'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import { useBusiness } from '@/context/BusinessContext'

function badgeVariantForMemberStatus(status) {
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

function badgeVariantForPaymentStatus(status) {
  switch ((status ?? '').toUpperCase()) {
    case 'PAID':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'FAILED':
    case 'OVERDUE':
      return 'danger'
    default:
      return 'secondary'
  }
}

function formatDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return parsed.toLocaleDateString()
}

export function MemberDetailsPanel({
  member,
  payments,
  paymentsLoading,
  onEdit,
  onRecordPayment,
  onSendReminder,
  onChangeStatus,
  onRequestDelete,
  onRefreshPayments,
  isUpdatingStatus,
  isDeleting,
}) {
  const { business } = useBusiness()

  const status = (member?.status ?? '').toUpperCase()
  const nextStatus = status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
  const statusActionLabel = nextStatus === 'SUSPENDED' ? 'Suspend member' : 'Activate member'

  const currency = business?.currency ?? 'USD'
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }),
    [currency],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              {member?.first_name} {member?.last_name}
            </h2>
            <Badge variant={badgeVariantForMemberStatus(status)}>{status || 'UNKNOWN'}</Badge>
          </div>
          {member?.email ? <p className="mt-1 text-sm text-slate-500">{member.email}</p> : null}
          {member?.membership_plan ? (
            <p className="mt-1 text-sm text-slate-500">
              Enrolled in <span className="font-medium text-slate-700">{member.membership_plan}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => onEdit(member)}>
            Edit member
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onRecordPayment(member)}>
            Record payment
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onSendReminder(member)}>
            Send reminder
          </Button>
          <Button
            size="sm"
            variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'}
            onClick={() => onChangeStatus(member, nextStatus)}
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus ? 'Updating…' : statusActionLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onRequestDelete(member)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing…' : 'Remove from roster'}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Membership</h3>
          <dl className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground">{status || 'Unknown'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium text-foreground">{member?.membership_plan ?? 'Not assigned'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Class</dt>
              <dd className="font-medium text-foreground">{member?.class_name ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Group</dt>
              <dd className="font-medium text-foreground">{member?.group_name ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium text-foreground">{formatDate(member?.join_date)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Next payment due</dt>
              <dd className="font-medium text-foreground">{formatDate(member?.next_payment_due)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact</h3>
          <dl className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">{member?.email ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium text-foreground">{member?.phone ?? member?.phone_number ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Status notes</dt>
              <dd className="max-w-[16rem] text-right text-sm text-slate-500">
                {member?.status_note ?? 'No notes yet'}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent payments</h3>
          {onRefreshPayments ? (
            <Button size="sm" variant="ghost" onClick={onRefreshPayments} disabled={paymentsLoading}>
              Refresh
            </Button>
          ) : null}
        </div>
        <Card className="divide-y p-0">
          {paymentsLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Spinner size="sm" className="text-primary" />
              Loading recent payments…
            </div>
          ) : payments?.length ? (
            payments.slice(0, 5).map((payment) => (
              <article key={payment.id} className="flex items-center justify-between gap-4 p-5 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {currencyFormatter.format(Number(payment.amount ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.payment_date)} • {payment.membership_plan ?? 'General membership'}
                  </p>
                </div>
                <Badge variant={badgeVariantForPaymentStatus(payment.status)}>{payment.status}</Badge>
              </article>
            ))
          ) : (
            <div className="p-5 text-sm text-muted-foreground">No payments recorded yet.</div>
          )}
        </Card>
      </section>
    </div>
  )
}
