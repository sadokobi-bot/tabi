import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'tabi-test-123'

/** Usernames are unique per test run (local accounts live in the test browser's storage). */
export const uniqueName = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`

export async function openSignUp(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'הרשמה', exact: true }).click()
}

/** Step 1 of sign-up: who you are. */
export async function fillDetails(page: Page, firstName = 'מאיה', lastName = 'כהן', gender: 'אישה' | 'גבר' | 'אחר' = 'אישה') {
  await page.getByLabel('שם פרטי').fill(firstName)
  await page.getByLabel('שם משפחה').fill(lastName)
  await page.getByRole('radio', { name: gender }).click()
  await page.getByRole('button', { name: 'המשך' }).click()
}

/** Step 2 of sign-up: the account. */
export async function fillAccount(page: Page, username: string, password = PASSWORD, confirm = password) {
  await page.getByLabel('שם משתמש').fill(username)
  await page.getByLabel('סיסמה', { exact: true }).fill(password)
  await page.getByLabel('אימות סיסמה').fill(confirm)
  await page.getByRole('checkbox', { name: /תנאי השימוש/ }).check()
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()
}

export async function signUp(page: Page, username: string, details?: Parameters<typeof fillDetails>) {
  await openSignUp(page)
  await fillDetails(page, ...(details ?? []))
  await fillAccount(page, username)
}

export async function signIn(page: Page, username: string, password = PASSWORD) {
  await page.goto('/')
  await page.getByLabel('שם משתמש').fill(username)
  await page.getByLabel('סיסמה', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'כניסה' }).click()
}

/** Local mode keeps every account in this browser: dropping the session signs out. */
export async function signOut(page: Page) {
  await page.evaluate(() => localStorage.removeItem('tabi:v1:session'))
}

export async function createFirstTrip(page: Page, { tour = 'skip' }: { tour?: 'skip' | 'keep' } = {}) {
  await page.getByRole('button', { name: /טיול חדש משלי/ }).click()
  await page.getByRole('button', { name: 'יצירת הטיול' }).click()
  if (tour === 'skip') await skipTour(page)
}

/** A new account's first visit opens the welcome tour: skip it. */
export async function skipTour(page: Page) {
  const tour = page.getByRole('dialog', { name: 'סיור באפליקציה' })
  await tour.getByRole('button', { name: 'דלגו' }).click({ timeout: 10_000 })
  await expect(tour).toHaveCount(0)
}
