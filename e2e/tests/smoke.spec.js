import { expect, test } from '@playwright/test'

test('first run through to an invoiced payment', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByLabel('Organization').fill('E2E Gym')
  await page.getByLabel('Your name').fill('Sam Owner')
  await page.getByLabel('Username').fill('owner')
  await page.getByLabel('Password').fill('very-secret-1')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sam/ })).toBeVisible()

  await page.goto('/courses')
  await page.getByRole('button', { name: 'New course' }).first().click()
  await page.getByLabel('Name').fill('CrossFit')
  await page.getByRole('button', { name: 'Create course' }).click()
  await expect(page.getByRole('heading', { name: 'CrossFit' })).toBeVisible()

  await page.goto('/plans')
  await page.getByRole('button', { name: 'New plan' }).first().click()
  await page.getByLabel('Name').fill('Monthly')
  await page.getByLabel('Price').fill('39')
  await page.getByRole('button', { name: 'Create plan' }).click()
  await expect(page.getByRole('cell', { name: '$39.00' })).toBeVisible()

  await page.goto('/members?new=1')
  const form = page.getByRole('dialog', { name: 'New member' })
  await form.getByLabel('First name').fill('Lina')
  await form.getByLabel('Last name').fill('Haddad')
  await form.getByLabel('Course').selectOption({ label: 'CrossFit' })
  await form.getByLabel('Plan').selectOption({ label: 'Monthly · $39.00' })
  await form.getByRole('button', { name: 'Add member' }).click()
  const sheet = page.getByRole('dialog', { name: 'Lina Haddad' })
  await expect(sheet.getByText('Due')).toBeVisible()

  await sheet.getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByText(/^Covers/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByRole('heading', { name: /Invoice INV-\d{4}-0001/ })).toBeVisible()
  const pdf = await page.request.get(await page.locator('iframe').getAttribute('src'))
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  await page.getByRole('button', { name: 'Done' }).click()

  await page.goto('/members')
  await expect(page.getByRole('row', { name: /Lina Haddad/ }).getByText('Active')).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('$39.00').first()).toBeVisible()
})

test('roster, attendance and a partial payment with its balance', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('owner')
  await page.getByLabel('Password').fill('very-secret-1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sam/ })).toBeVisible()

  // A group inside the course.
  await page.goto('/courses')
  await page.getByRole('button', { name: 'Course actions' }).click()
  await page.getByRole('menuitem', { name: 'Add group' }).click()
  await page.getByRole('dialog', { name: 'New group' }).getByLabel('Name').fill('Morning')
  await page.getByRole('button', { name: 'Add group' }).click()
  await expect(page.getByText('Morning')).toBeVisible()

  // A member placed in that group.
  await page.goto('/members?new=1')
  const form = page.getByRole('dialog', { name: 'New member' })
  await form.getByLabel('First name').fill('Ben')
  await form.getByLabel('Last name').fill('Carter')
  await form.getByLabel('Course').selectOption({ label: 'CrossFit' })
  await form.getByLabel('Group').selectOption({ label: 'Morning' })
  await form.getByLabel('Plan').selectOption({ label: 'Monthly · $39.00' })
  await form.getByRole('button', { name: 'Add member' }).click()
  await expect(page.getByRole('dialog', { name: 'Ben Carter' })).toBeVisible()

  // The course roster lists him under the group, and attendance can be taken there.
  await page.goto('/courses')
  await page.getByRole('link', { name: 'CrossFit' }).first().click()
  await expect(page.getByRole('heading', { name: 'CrossFit' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ben Carter' })).toBeVisible()
  await page.getByRole('button', { name: 'Take attendance for Morning' }).click()
  await page.getByRole('button', { name: 'Mark all present' }).click()
  await page.getByRole('button', { name: 'Save attendance' }).click()
  await expect(page.getByText('Attendance saved')).toBeVisible()
  await expect(page.getByText('100%')).toBeVisible()

  // Paying less than the price leaves a balance.
  await page.getByRole('link', { name: 'Ben Carter' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ben Carter' })
  await sheet.getByRole('button', { name: 'Record payment' }).click()
  const dialog = page.getByRole('dialog', { name: 'Record payment' })
  await dialog.getByLabel('Amount').fill('20')
  await expect(dialog.getByText(/Partial payment\. Balance after this payment: \$19\.00/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByRole('heading', { name: /Invoice INV-/ })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.goto('/members')
  await expect(page.getByRole('row', { name: /Ben Carter/ }).getByText('owes $19.00')).toBeVisible()

  // Both payments show up in today's cash report.
  await page.goto('/payments/daily')
  await expect(page.getByText('$59.00').first()).toBeVisible()
  await expect(page.getByText('Ben Carter')).toBeVisible()
})
