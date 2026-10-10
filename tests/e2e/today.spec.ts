import { expect, test } from '@playwright/test'
import { createFirstTrip, signUp, uniqueName } from './helpers'

test('the currency converter sits under the day card, and can be put away and brought back', async ({ page }) => {
  await signUp(page, uniqueName('fx'))
  await createFirstTrip(page)

  const amount = page.getByLabel('סכום בין')
  await expect(amount).toBeVisible()
  await page.getByRole('button', { name: 'הסתרה' }).click()
  await expect(amount).toHaveCount(0)

  // Still put away after reopening the app; the yen button in the header brings it back.
  await page.reload()
  const restore = page.getByRole('button', { name: 'הצגת ממיר המטבע' })
  await expect(restore).toBeVisible()
  await restore.click()
  await expect(amount).toBeVisible()
  await expect(restore).toHaveCount(0)
})
