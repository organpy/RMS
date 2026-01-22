import { z } from 'zod'

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  },
  z.string().optional(),
)

const optionalPositiveInt = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const numberValue = Number(value)
    return Number.isNaN(numberValue) ? value : numberValue
  },
  z.number().int().positive().max(3650).optional(),
)

export const memberStatusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

export const memberFormSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  membership_plan: optionalText,
  payment_interval_days: optionalPositiveInt,
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
})

export const memberFormDefaults = {
  first_name: '',
  last_name: '',
  email: '',
  membership_plan: '',
  payment_interval_days: '',
  status: 'ACTIVE',
}
