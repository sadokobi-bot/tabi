import { expect, test, type Page } from '@playwright/test'
import { createFirstTrip, signIn, signOut, signUp, uniqueName } from './helpers'

// Two accounts sign up and in again (each sign-in waits for the launch intro and hashes a password).
test.setTimeout(120_000)

async function inviteCodeOf(page: Page) {
  await page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()
  const code = (await page.locator('code').first().innerText()).trim()
  await page.keyboard.press('Escape')
  return code
}

test('joining needs the owner: request, approve, then the trip opens; only the owner edits trip details', async ({ page }) => {
  const owner = uniqueName('owner')
  const guest = uniqueName('guest')

  // The owner creates a trip and reads its invite code.
  await signUp(page, owner, ['קובי', 'כהן', 'גבר'])
  await createFirstTrip(page)
  const code = await inviteCodeOf(page)
  expect(code).toMatch(/^[A-Z0-9]{6,}$/)

  // A guest asks to join with the code and waits.
  await signOut(page)
  await signUp(page, guest, ['נועה', 'לוי', 'אישה'])
  await page.getByRole('button', { name: /הצטרפות לטיול קיים/ }).click()
  await page.getByLabel('קוד הזמנה').fill(code)
  await page.getByRole('button', { name: 'שליחת בקשה להצטרפות' }).click()
  await expect(page.getByRole('status')).toHaveText('הבקשה נשלחה')
  await expect(page.getByText(/מחכים לאישור של קובי כהן/)).toBeVisible()

  // Still waiting after reopening the app.
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('הבקשה נשלחה')

  // The owner sees the request (with the right Hebrew form) and approves it.
  await signOut(page)
  await signIn(page, owner)
  const requests = page.getByRole('region', { name: 'בקשות הצטרפות' }).first()
  await expect(requests).toContainText('נועה לוי מבקשת להצטרף לטיול')
  await requests.getByRole('button', { name: 'אישור' }).click()
  await expect(requests).toBeHidden()

  // The guest is in, and can't rename or resize the trip.
  await signOut(page)
  await signIn(page, guest)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('נועה')
  await page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()
  await expect(page.getByText(/רק קובי כהן יכול לשנות את שם הטיול/)).toBeVisible()
  await expect(page.getByLabel('שם הטיול')).toHaveCount(0)
})

test('a declined request says so and offers another code', async ({ page }) => {
  const owner = uniqueName('own2')
  const guest = uniqueName('gst2')
  await signUp(page, owner, ['דן', 'אור', 'גבר'])
  await createFirstTrip(page)
  const code = await inviteCodeOf(page)

  await signOut(page)
  await signUp(page, guest, ['איתי', 'בר', 'גבר'])
  await page.getByRole('button', { name: /הצטרפות לטיול קיים/ }).click()
  await page.getByLabel('קוד הזמנה').fill(code)
  await page.getByRole('button', { name: 'שליחת בקשה להצטרפות' }).click()
  await expect(page.getByRole('status')).toHaveText('הבקשה נשלחה')

  await signOut(page)
  await signIn(page, owner)
  const requests = page.getByRole('region', { name: 'בקשות הצטרפות' }).first()
  await expect(requests).toContainText('איתי בר מבקש להצטרף לטיול')
  await requests.getByRole('button', { name: 'דחייה' }).click()

  await signOut(page)
  await signIn(page, guest)
  await expect(page.getByRole('status')).toHaveText('הבקשה לא אושרה')
  await page.getByRole('button', { name: 'הקלדת קוד אחר' }).click()
  await expect(page.getByLabel('קוד הזמנה')).toBeVisible()
})

/** A new account asks to join the owner's trip with its code, and the owner approves. */
async function joinAndApprove(page: Page, owner: string, guest: string) {
  await signUp(page, owner, ['רון', 'שגב', 'גבר'])
  await createFirstTrip(page)
  const code = await inviteCodeOf(page)

  await signOut(page)
  await signUp(page, guest, ['שירה', 'גל', 'אישה'])
  await page.getByRole('button', { name: /הצטרפות לטיול קיים/ }).click()
  await page.getByLabel('קוד הזמנה').fill(code)
  await page.getByRole('button', { name: 'שליחת בקשה להצטרפות' }).click()
  await expect(page.getByRole('status')).toHaveText('הבקשה נשלחה')

  await signOut(page)
  await signIn(page, owner)
  const requests = page.getByRole('region', { name: 'בקשות הצטרפות' }).first()
  await requests.getByRole('button', { name: 'אישור' }).click()
  await expect(requests).toBeHidden()
}

async function removeGuest(page: Page, owner: string) {
  await signOut(page)
  await signIn(page, owner)
  await page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()
  await page.getByRole('button', { name: 'הסרת שירה גל מהטיול' }).click()
  await page.getByRole('button', { name: 'להסיר?' }).click()
  await expect(page.getByRole('button', { name: 'הסרת שירה גל מהטיול' })).toHaveCount(0)
}

async function expectChoice(page: Page) {
  // No trips left: back to choosing, not an endless loading screen.
  await expect(page.getByRole('button', { name: /הצטרפות לטיול קיים/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /טיול חדש משלי/ })).toBeVisible()
}

test('a member removed from their only trip is offered to join or create one again', async ({ page }) => {
  const owner = uniqueName('own3')
  const guest = uniqueName('gst3')
  await joinAndApprove(page, owner, guest)

  // She opens the trip, then the owner removes her.
  await signOut(page)
  await signIn(page, guest)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('שירה')
  await removeGuest(page, owner)

  await signOut(page)
  await signIn(page, guest)
  await expectChoice(page)
})

test('removed before ever opening the trip: the old request is forgotten', async ({ page }) => {
  const owner = uniqueName('own4')
  const guest = uniqueName('gst4')
  await joinAndApprove(page, owner, guest)
  await removeGuest(page, owner)

  await signOut(page)
  await signIn(page, guest)
  await expectChoice(page)
  await expect(page.getByText('הבקשה לא אושרה')).toHaveCount(0)
})
