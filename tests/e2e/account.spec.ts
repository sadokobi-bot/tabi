import { expect, test, type Page } from '@playwright/test'
import { createFirstTrip, fillDetails, openSignUp, PASSWORD, signIn, signOut, signUp, skipTour, uniqueName } from './helpers'

// Several accounts sign up and in again (each sign-in waits for the launch intro and hashes a password).
test.setTimeout(120_000)

const openProfile = (page: Page) => page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()

test('sign-up needs the terms accepted, and both documents open from there', async ({ page }) => {
  await openSignUp(page)
  await fillDetails(page)
  await page.getByLabel('שם משתמש').fill(uniqueName('terms'))
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD)
  await page.getByLabel('אימות סיסמה').fill(PASSWORD)
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()
  // Not ticked: still on the form.
  await expect(page.getByRole('button', { name: 'יצירת חשבון' })).toBeVisible()

  await page.getByRole('button', { name: 'מדיניות הפרטיות' }).click()
  const legal = page.getByRole('dialog', { name: 'מדיניות פרטיות' })
  await expect(legal).toContainText('איזה מידע נשמר')
  await legal.getByRole('tab', { name: 'תנאי שימוש' }).click()
  await expect(page.getByRole('dialog', { name: 'תנאי שימוש' })).toContainText('מידע ובינה מלאכותית')
  await page.getByRole('button', { name: 'סגירה' }).click()

  await page.getByRole('checkbox', { name: /תנאי השימוש/ }).check()
  await page.getByRole('button', { name: 'יצירת חשבון' }).click()
  await expect(page.getByRole('button', { name: /טיול חדש משלי/ })).toBeVisible()
})

test('an account from before the terms accepts them once', async ({ page }) => {
  const name = uniqueName('old')
  await signUp(page, name)
  await expect(page.getByRole('button', { name: /טיול חדש משלי/ })).toBeVisible()
  // As if it signed up before there were terms.
  await page.evaluate(() => {
    const users = JSON.parse(localStorage.getItem('tabi:v1:users') ?? '{}') as Record<string, { termsVersion?: number }>
    for (const user of Object.values(users)) delete user.termsVersion
    localStorage.setItem('tabi:v1:users', JSON.stringify(users))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'פרטיות ותנאי שימוש' })).toBeVisible()
  await page.getByRole('button', { name: 'אישור והמשך' }).click()
  await expect(page.getByRole('heading', { name: 'פרטיות ותנאי שימוש' })).toBeVisible()
  await page.getByRole('checkbox', { name: /תנאי השימוש/ }).check()
  await page.getByRole('button', { name: 'אישור והמשך' }).click()
  await expect(page.getByRole('button', { name: /טיול חדש משלי/ })).toBeVisible()
})

test('a member leaves; the owner hands the trip over, then leaves too', async ({ page }) => {
  const owner = uniqueName('lown')
  const guest = uniqueName('lgst')
  await signUp(page, owner, ['קובי', 'כהן', 'גבר'])
  await createFirstTrip(page)
  await openProfile(page)
  const code = (await page.locator('code').first().innerText()).trim()
  await page.keyboard.press('Escape')

  await signOut(page)
  await signUp(page, guest, ['נועה', 'לוי', 'אישה'])
  await page.getByRole('button', { name: /הצטרפות לטיול קיים/ }).click()
  await page.getByLabel('קוד הזמנה').fill(code)
  await page.getByRole('button', { name: 'שליחת בקשה להצטרפות' }).click()
  await expect(page.getByRole('status')).toHaveText('הבקשה נשלחה')

  await signOut(page)
  await signIn(page, owner)
  const requests = page.getByRole('region', { name: 'בקשות הצטרפות' }).first()
  await requests.getByRole('button', { name: 'אישור' }).click()
  await expect(requests).toBeHidden()

  // The owner hands the trip to Noa and leaves: back to "no trips yet".
  await openProfile(page)
  await page.getByRole('button', { name: 'עזיבת הטיול' }).click()
  const leaving = page.getByRole('alertdialog', { name: 'עזיבת הטיול' })
  await expect(leaving).toContainText('מי ינהל את הטיול במקומכם?')
  await leaving.getByRole('button', { name: 'העברה ועזיבה' }).click()
  await expect(page.getByRole('button', { name: /טיול חדש משלי/ })).toBeVisible()

  // Noa now runs the trip, and is alone in it: nothing to leave, only to delete.
  await signOut(page)
  await signIn(page, guest)
  await skipTour(page)
  await openProfile(page)
  await expect(page.getByLabel('שם הטיול')).toBeVisible()
  await expect(page.getByRole('button', { name: 'עזיבת הטיול' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'מחיקת הטיול' })).toBeVisible()
})

test('deleting the account needs the password, then the account is gone', async ({ page }) => {
  const name = uniqueName('gone')
  await signUp(page, name)
  await createFirstTrip(page)
  await openProfile(page)
  await page.getByRole('button', { name: 'מחיקת החשבון' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'מחיקת החשבון' })
  await expect(dialog).toContainText('יימחק, כי רק אתם בהם')

  await dialog.getByLabel('הסיסמה שלכם (לאישור)').fill('wrong-password')
  await dialog.getByRole('button', { name: 'מחיקת החשבון לצמיתות' }).click()
  await expect(dialog).toContainText('הסיסמה שגויה')

  await dialog.getByLabel('הסיסמה שלכם (לאישור)').fill(PASSWORD)
  await dialog.getByRole('button', { name: 'מחיקת החשבון לצמיתות' }).click()
  await expect(page.getByRole('button', { name: 'כניסה' })).toBeVisible()

  await signIn(page, name)
  await expect(page.getByRole('alert')).toContainText('שם משתמש או סיסמה שגויים')
})
