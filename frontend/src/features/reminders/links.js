const digits = (phone) => phone.replace(/[^\d+]/g, '').replace(/^\+/, '')

export function reminderLink(channel, item, subject) {
  const text = encodeURIComponent(item.message)
  if (channel === 'email') return `mailto:${item.email}?subject=${encodeURIComponent(subject)}&body=${text}`
  if (channel === 'sms') return `sms:${item.phone}?&body=${text}`
  return `https://wa.me/${digits(item.phone)}?text=${text}`
}

export const canUse = (channel, item) => Boolean(channel === 'email' ? item.email : item.phone)
