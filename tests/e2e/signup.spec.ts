import { expect, test } from '@playwright/test'
import { createFirstTrip, fillAccount, fillDetails, openSignUp, PASSWORD, signUp, uniqueName } from './helpers'

test('a new user signs up in two steps, creates a trip and lands on Today', async ({ page }) => {
  const username = uniqueName('maya')
  await openSignUp(page)

  // Step 1: personal details are required.
  await page.getByRole('button', { name: 'המשך' }).click()
  await expect(page.getByText('הקלידו שם פרטי')).toBeVisible()
  await expect(page.getByText('בחרו אחת מהאפשרויות')).toBeVisible()
  await fillDetails(page, 'מאיה', 'כהן', 'אישה')

  // Step 2: the account, greeted by first name.
  await expect(page.getByText('מאיה, בחרו שם משתמש וסיסמה לכניסה')).toBeVisible()
  await fillAccount(page, username)

  // A new account chooses how to start: its own trip, or joining one with an invite code.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ברוכים הבאים, מאיה')
  await expect(page.getByRole('button', { name: /הצטרפות לטיול קיים/ })).toBeVisible()
  await createFirstTrip(page)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('מאיה')
  await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toBeVisible()
  await expect(page.getByText(/יום \d+ מתוך \d+|עוד \d+ ימים לטיול|מחר טסים/)).toBeVisible()

  // The session survives a reload.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('מאיה')
})

test('passwords that do not match are rejected', async ({ page }) => {
  await openSignUp(page)
  await fillDetails(page)
  await fillAccount(page, uniqueName('noa'), PASSWORD, `${PASSWORD}x`)
  await expect(page.getByText('הסיסמאות לא תואמות')).toBeVisible()
  await expect(page.getByRole('button', { name: 'יצירת חשבון' })).toBeVisible()
})

test('a password shorter than 6 characters is rejected', async ({ page }) => {
  await openSignUp(page)
  await fillDetails(page)
  await fillAccount(page, uniqueName('dan'), '12345')
  await expect(page.getByText('לפחות 6 תווים')).toBeVisible()
  await expect(page.getByRole('button', { name: 'יצירת חשבון' })).toBeVisible()
})

test('a taken username is rejected', async ({ page }) => {
  const username = uniqueName('itai')
  await signUp(page, username, ['איתי', 'לוי', 'גבר'])
  await expect(page.getByRole('heading', { level: 1 })).toContainText('איתי')

  // Sign out by dropping the local session, then try the same name again.
  await page.evaluate(() => localStorage.removeItem('tabi:v1:session'))
  await signUp(page, username.toUpperCase())
  await expect(page.getByText(/שם המשתמש הזה כבר תפוס/)).toBeVisible()
})

test('the sign-up screen has no horizontal overflow on a phone', async ({ page }) => {
  await openSignUp(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await fillDetails(page)

  // The show-password button must not cover the typed characters.
  await page.getByLabel('סיסמה', { exact: true }).fill('abcdefgh')
  const field = await page.getByLabel('סיסמה', { exact: true }).boundingBox()
  const eye = await page.getByRole('button', { name: 'הצגת הסיסמה' }).boundingBox()
  const paddingLeft = await page.getByLabel('סיסמה', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
  expect(field && eye).toBeTruthy()
  expect(field!.x + paddingLeft).toBeGreaterThanOrEqual(eye!.x + eye!.width)
  await page.screenshot({ path: 'test-results/signup-screen.png' })
})

test('signing out from the profile sheet and back in opens the app, not the sheet', async ({ page }) => {
  const username = uniqueName('out')
  await signUp(page, username)
  await createFirstTrip(page)
  await page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'יציאה' }).click()
  // Straight back in, without reloading the page (as on a phone).
  await page.getByLabel('שם משתמש').fill(username)
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'כניסה' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // The sheet used to slide in a moment after Today appeared.
  await page.waitForTimeout(1500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
