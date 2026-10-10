import { expect, test } from '@playwright/test'
import { createFirstTrip, signUp, uniqueName } from './helpers'

test.setTimeout(90_000)

test('the community opens after agreeing to its rules; a message can be posted and deleted', async ({ page }) => {
  await signUp(page, uniqueName('comm'), ['נועה', 'לוי', 'אישה'])
  await createFirstTrip(page)
  await page.getByRole('link', { name: 'צ׳אט' }).click()

  await page.getByRole('tab', { name: 'קהילת Tabi' }).click()
  const join = page.getByRole('button', { name: 'הצטרפות לקהילה' })
  await expect(page.getByText('הכללים שלנו')).toBeVisible()
  await expect(join).toBeDisabled()
  await page.getByRole('checkbox', { name: /קראתי את הכללים/ }).check()
  await join.click()

  // Two rooms: the general chat and recommendations.
  await expect(page.getByRole('tab', { name: 'שיחה כללית' })).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('הודעה לקהילה').fill('היי! מישהו היה בקנאזאווה?')
  await page.getByLabel('הודעה לקהילה').press('Enter')
  const message = page.getByRole('button', { name: /היי! מישהו היה בקנאזאווה/ })
  await expect(message).toBeVisible()

  // Another message right away waits a few seconds.
  await page.getByLabel('הודעה לקהילה').fill('עוד שאלה')
  await page.getByLabel('הודעה לקהילה').press('Enter')
  await expect(page.getByText('רגע, אפשר לשלוח הודעה לקהילה פעם בכמה שניות')).toBeVisible()

  // Recommendations is its own room.
  await page.getByRole('tab', { name: 'המלצות' }).click()
  await expect(page.getByText('עוד אין כאן הודעות')).toBeVisible()
  await page.getByRole('tab', { name: 'שיחה כללית' }).click()

  await message.click()
  await page.getByRole('button', { name: 'מחיקת ההודעה' }).click()
  await expect(message).toHaveCount(0)

  // The choice of room is remembered: the chat tab reopens on the community.
  await page.reload()
  await page
    .getByRole('dialog', { name: 'סיור באפליקציה' })
    .getByRole('button', { name: 'דלגו' })
    .click({ timeout: 3000 })
    .catch(() => undefined)
  await page.getByRole('link', { name: 'צ׳אט' }).click()
  await expect(page.getByRole('tab', { name: 'קהילת Tabi' })).toHaveAttribute('aria-selected', 'true')
})

test('the transit guide opens from Today', async ({ page }) => {
  await signUp(page, uniqueName('rail'))
  await createFirstTrip(page)
  await page.getByRole('button', { name: /איך מתניידים ביפן/ }).click()
  const guide = page.getByRole('dialog', { name: 'איך מתניידים ביפן' })
  await expect(guide).toContainText('Suica')
  await guide.getByRole('button', { name: /שינקנסן/ }).click()
  await expect(guide).toContainText('מושב E')
})
