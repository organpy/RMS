import { Download, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useMember } from '@/features/members/api'
import { useMessagingStatus } from '@/features/messaging/api'
import { usePlans } from '@/features/plans/api'
import { cn } from '@/lib/cn'
import { date, money, today } from '@/lib/format'

import { invoiceUrl, useEmailInvoice, useRecordPayment } from './api'
import { MemberPicker } from './member-picker'

const METHODS = [
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['transfer', 'Transfer'],
  ['other', 'Other'],
]

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

function coverage(member, plan, paidOn) {
  if (!plan || !paidOn) return null
  const next = member.paid_until ? addDays(member.paid_until, 1) : paidOn
  const start = next > paidOn ? next : paidOn
  return [start, addDays(start, plan.interval_days - 1)]
}

function PaymentForm({ member, onMember, onRecorded }) {
  const record = useRecordPayment()
  const { data: plans = [] } = usePlans(member.course_id ? { course_id: member.course_id } : {})
  const { data: messaging } = useMessagingStatus()
  const canEmail = !!(messaging?.email && member.email)
  const { register, handleSubmit, control, setValue } = useForm({
    defaultValues: { plan_id: member.plan_id ? String(member.plan_id) : 'one-off', amount: member.plan_price ?? '', method: 'cash', paid_on: today(), description: '', notes: '', email_invoice: true },
  })
  const [planId, method, paidOn] = useWatch({ control, name: ['plan_id', 'method', 'paid_on'] })
  const plan = plans.find((p) => String(p.id) === planId)
  const period = coverage(member, plan, paidOn)

  const submit = (v) =>
    record.mutate(
      {
        member_id: member.id,
        plan_id: plan?.id ?? null,
        amount: Number(v.amount).toFixed(2),
        method: v.method,
        paid_on: v.paid_on,
        description: plan ? null : v.description.trim(),
        notes: v.notes.trim() || null,
        email_invoice: canEmail && v.email_invoice,
      },
      { onSuccess: onRecorded },
    )

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
      <Field label="Member" group>
        <MemberPicker value={member} onChange={onMember} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="For">
          <Select
            {...register('plan_id', {
              onChange: (e) => setValue('amount', plans.find((p) => String(p.id) === e.target.value)?.price ?? ''),
            })}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="one-off">One-off payment</option>
          </Select>
        </Field>
        <Field label="Amount">
          <Input type="number" step="0.01" min="0" required {...register('amount')} />
        </Field>
      </div>
      {!plan && (
        <Field label="Description">
          <Input required placeholder="e.g. Registration fee, Uniform" {...register('description')} />
        </Field>
      )}
      <Field label="Method" group>
        <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
          {METHODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('method', value)}
              className={cn('h-7 rounded text-[13px] text-muted-foreground', method === value && 'bg-background font-medium text-foreground shadow-sm')}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Paid on">
        <Input type="date" required max={today()} {...register('paid_on')} />
      </Field>
      <Field label="Notes">
        <Textarea rows={2} {...register('notes')} />
      </Field>
      {period && (
        <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          Covers <span className="font-medium text-foreground">{date(period[0])}</span> to <span className="font-medium text-foreground">{date(period[1])}</span>
        </p>
      )}
      <DialogFooter>
        {canEmail && (
          <label className="mr-auto flex items-center gap-2 text-[13px] text-muted-foreground">
            <input type="checkbox" className="accent-accent" {...register('email_invoice')} />
            Email invoice to {member.email}
          </label>
        )}
        <Button type="submit" disabled={record.isPending}>
          Record payment
        </Button>
      </DialogFooter>
    </form>
  )
}

function Receipt({ payment, onDone }) {
  const { data: messaging } = useMessagingStatus()
  const email = useEmailInvoice()
  const sent = payment.invoice_email === 'sent' || email.isSuccess
  return (
    <div className="grid gap-4">
      <iframe title="Invoice preview" src={invoiceUrl(payment.id)} className="h-[55vh] w-full rounded-md border bg-white" />
      {payment.invoice_email === 'failed' && !email.isSuccess && <p className="text-[13px] text-danger">The invoice email could not be sent. Check the member's message history.</p>}
      <DialogFooter>
        {messaging?.email && (
          <Button variant="ghost" className="mr-auto" disabled={sent || email.isPending} onClick={() => email.mutate(payment.id)}>
            <Mail /> {sent ? 'Emailed' : 'Email invoice'}
          </Button>
        )}
        <Button variant="outline" onClick={() => window.open(invoiceUrl(payment.id, true), '_self')}>
          <Download /> Download
        </Button>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  )
}

export function PaymentDialog({ open, onOpenChange, memberId }) {
  // undefined = use the member from the URL, null = cleared by the user
  const [picked, setPicked] = useState(undefined)
  const [recorded, setRecorded] = useState(null)
  const { data: preset } = useMember(open && picked === undefined ? memberId : null)
  const member = picked === undefined ? (memberId ? preset : null) : picked

  const close = () => {
    onOpenChange(false)
    setPicked(undefined)
    setRecorded(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={recorded ? `Invoice ${recorded.invoice_number}` : 'Record payment'}
        description={recorded ? `${money(recorded.amount)} from ${recorded.member_name}` : undefined}
        className={recorded ? 'max-w-2xl' : 'max-w-md'}
      >
        {recorded ? (
          <Receipt payment={recorded} onDone={close} />
        ) : member ? (
          <PaymentForm key={member.id} member={member} onMember={setPicked} onRecorded={setRecorded} />
        ) : (
          <Field label="Member" group>
            <MemberPicker value={null} onChange={setPicked} />
          </Field>
        )}
      </DialogContent>
    </Dialog>
  )
}
