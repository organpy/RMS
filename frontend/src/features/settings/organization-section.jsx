import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useUpdateOrg } from '@/features/organization/api'

import { Section } from './section'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'MAD', 'DZD', 'TND', 'XOF', 'AED', 'SAR', 'JPY']
const LOCALES = [
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['fr-FR', 'Français'],
  ['de-DE', 'Deutsch'],
  ['es-ES', 'Español'],
  ['ar-MA', 'العربية'],
]

const trimOrNull = (v) => (typeof v === 'string' ? v.trim() || null : v)

export function useOrgForm(org, fields) {
  const update = useUpdateOrg()
  const form = useForm({ defaultValues: Object.fromEntries(fields.map((f) => [f, org[f] ?? ''])) })
  const onSubmit = form.handleSubmit((v) =>
    update.mutate(Object.fromEntries(Object.entries(v).map(([k, val]) => [k, trimOrNull(val)])), {
      onSuccess: (saved) => {
        form.reset(Object.fromEntries(fields.map((f) => [f, saved[f] ?? ''])))
        toast.success('Settings saved')
      },
      onError: (e) => toast.error(e.message),
    }),
  )
  return { ...form, onSubmit, saving: update.isPending }
}

export function SaveBar({ form }) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={!form.formState.isDirty || form.saving}>
        Save
      </Button>
    </div>
  )
}

export function OrganizationSection({ org }) {
  const form = useOrgForm(org, ['name', 'email', 'phone', 'address', 'tax_id'])
  const { register } = form
  return (
    <Section id="organization" title="Organization" description="Shown on invoices and in the app.">
      <form className="grid gap-4" onSubmit={form.onSubmit}>
        <Field label="Name">
          <Input required {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Phone">
            <Input {...register('phone')} />
          </Field>
        </div>
        <Field label="Address">
          <Textarea rows={3} {...register('address')} />
        </Field>
        <Field label="Tax / registration number">
          <Input {...register('tax_id')} />
        </Field>
        <SaveBar form={form} />
      </form>
    </Section>
  )
}

export function BillingSection({ org }) {
  const form = useOrgForm(org, ['currency', 'locale', 'invoice_prefix', 'grace_days'])
  const { register } = form
  return (
    <Section id="billing" title="Billing" description="Currency, number formatting, invoice numbering and how long members stay ‘due’ before ‘overdue’.">
      <form className="grid gap-4" onSubmit={form.onSubmit}>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <Select {...register('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Language & format">
            <Select {...register('locale')}>
              {LOCALES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice prefix" hint={`e.g. ${form.watch('invoice_prefix') || 'INV'}-${new Date().getFullYear()}-0001`}>
            <Input maxLength={10} {...register('invoice_prefix', { setValueAs: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
          </Field>
          <Field label="Grace period (days)">
            <Input type="number" min={0} max={90} {...register('grace_days', { valueAsNumber: true })} />
          </Field>
        </div>
        <SaveBar form={form} />
      </form>
    </Section>
  )
}
