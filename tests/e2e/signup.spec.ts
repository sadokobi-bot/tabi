import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'tabi-test-123'

/** Usernames are unique per test run (local accounts live in the test browser's storage). */
const uniqueName = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}`

async function openSignUp(page: Page) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'הרשמה' }).click()
}

async function fillSignUp(page: Page, username: string, password: string, confirm = password) {
  await page.getByLabel('שם משתמש').fill(username)
  await page.getByLabel('סיסמה', { exact: true }).fill(password)
  await page.getByLabel('אימות סיסמה').fill(confirm)
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()
}

test('a new user signs up and lands on Today with a first trip', async ({ page }) => {
  const username = uniqueName('maya')
  await openSignUp(page)
  await fillSignUp(page, username, PASSWORD)

  // A trip is created automatically, so the app opens straight on the Today screen.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username)
  await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toBeVisible()
  await expect(page.getByText(/יום \d+ מתוך \d+|עוד \d+ ימים לטיול|מחר טסים/)).toBeVisible()

  // The session survives a reload.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username)
})

test('passwords that do not match are rejected', async ({ page }) => {
  await openSignUp(page)
  await fillSignUp(page, uniqueName('noa'), PASSWORD, `${PASSWORD}x`)
  await expect(page.getByText('הסיסמאות לא תואמות')).toBeVisible()
  await expect(page.getByRole('button', { name: 'יצירת חשבון' })).toBeVisible()
})

test('a password shorter than 6 characters is rejected', async ({ page }) => {
  await openSignUp(page)
  await fillSignUp(page, uniqueName('dan'), '12345')
  await expect(page.getByText('לפחות 6 תווים')).toBeVisible()
  await expect(page.getByRole('button', { name: 'יצירת חשבון' })).toBeVisible()
})

test('a taken username is rejected', async ({ page }) => {
  const username = uniqueName('itai')
  await openSignUp(page)
  await fillSignUp(page, username, PASSWORD)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(username)

  // Sign out by dropping the local session, then try the same name again.
  await page.evaluate(() => localStorage.removeItem('tabi:v1:session'))
  await openSignUp(page)
  await fillSignUp(page, username.toUpperCase(), PASSWORD)
  await expect(page.getByText(/שם המשתמש הזה כבר תפוס/)).toBeVisible()
})

test('the sign-up screen has no horizontal overflow on a phone', async ({ page }) => {
  await openSignUp(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // The show-password button must not cover the typed characters.
  await page.getByLabel('סיסמה', { exact: true }).fill('abcdefgh')
  const field = await page.getByLabel('סיסמה', { exact: true }).boundingBox()
  const eye = await page.getByRole('button', { name: 'הצגת הסיסמה' }).boundingBox()
  const paddingLeft = await page.getByLabel('סיסמה', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
  expect(field && eye).toBeTruthy()
  expect(field!.x + paddingLeft).toBeGreaterThanOrEqual(eye!.x + eye!.width)
  await page.screenshot({ path: 'test-results/signup-screen.png' })
})
