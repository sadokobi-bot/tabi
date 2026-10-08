import { expect, test } from '@playwright/test'
import { createFirstTrip, fillDetails, openSignUp, signUp, uniqueName } from './helpers'

test('field hints and errors are announced with their field', async ({ page }) => {
  await openSignUp(page)
  await fillDetails(page)

  const username = page.getByLabel('שם משתמש')
  await expect(username).toHaveAccessibleDescription('עברית או אנגלית, 2-16 תווים')

  await username.fill('a')
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(username).toHaveAccessibleDescription(/לפחות 2 תווים/)
})

test('a sheet keeps Tab inside and returns focus to its opener', async ({ page }) => {
  await signUp(page, uniqueName('sheet'))
  await createFirstTrip(page)

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
