import { describe, expect, it, vi } from 'vitest'

import { reminderLink } from '@/features/reminders/links'

import { api, url } from './api'
import { configureFormat, initials, money } from './format'
import { applyBrand } from './theme'

describe('url', () => {
  it('drops empty params', () => {
    expect(url('/members', { q: 'ann', status: '', page: 2, x: null })).toBe('/api/members?q=ann&page=2')
  })
})

describe('api errors', () => {
  it('flattens validation errors and flags 401s', async () => {
    const listener = vi.fn()
    window.addEventListener('rms:unauthorized', listener)
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ detail: [{ msg: 'Value error, bad period' }] }), { status: 422 }))
    await expect(api.post('/payments', {})).rejects.toMatchObject({ status: 422, message: 'bad period' })
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 }))
    await expect(api.get('/members')).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('format', () => {
  it('formats money in the organization currency', () => {
    configureFormat({ locale: 'en-US', currency: 'EUR' })
    expect(money('1234.5')).toBe('€1,234.50')
    expect(money(null)).toBe('—')
  })
  it('builds initials', () => {
    expect(initials('Lina Haddad Benali')).toBe('LH')
  })
})

describe('applyBrand', () => {
  it('picks a legible foreground for the accent', () => {
    applyBrand('#fde047')
    expect(document.documentElement.style.getPropertyValue('--accent-foreground')).toBe('#09090b')
    applyBrand('#1e3a8a')
    expect(document.documentElement.style.getPropertyValue('--accent-foreground')).toBe('#ffffff')
  })
})

describe('reminderLink', () => {
  const item = { email: 'a@b.co', phone: '+33 6 12-34', message: 'Hi & bye' }
  it('builds channel links', () => {
    expect(reminderLink('email', item, 'Due')).toBe('mailto:a@b.co?subject=Due&body=Hi%20%26%20bye')
    expect(reminderLink('whatsapp', item)).toBe('https://wa.me/3361234?text=Hi%20%26%20bye')
  })
})
