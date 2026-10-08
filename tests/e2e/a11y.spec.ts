import { expect, test } from '@playwright/test'

test('field hints and errors are announced with their field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'הרשמה', exact: true }).click()

  const username = page.getByLabel('שם משתמש')
  await expect(username).toHaveAccessibleDescription('עברית או אנגלית, 2-16 תווים')

  await username.fill('a')
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(username).toHaveAccessibleDescription(/לפחות 2 תווים/)
})

test('a sheet keeps Tab inside and returns focus to its opener', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'הרשמה', exact: true }).click()
  await page.getByLabel('שם משתמש').fill(`sheet${Date.now().toString(36).slice(-5)}`)
  await page.getByLabel('סיסמה', { exact: true }).fill('tabi-test-123')
  await page.getByLabel('אימות סיסמה').fill('tabi-test-123')
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()

  const opener = page.getByRole('button', { name: 'פרופיל והגדרות הטיול' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const sheet = page.getByRole('dialog', { name: 'פרופיל והגדרות הטיול' })
  await expect(sheet).toBeVisible()

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(opener).toBeFocused()
})
