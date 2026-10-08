import { expect, test } from '@playwright/test'
import { createFirstTrip, signUp, uniqueName } from './helpers'

test('a new user gets a short tour once, and can replay it from the profile', async ({ page }) => {
  await signUp(page, uniqueName('tour'), ['דנה', 'לוי', 'אישה'])
  await createFirstTrip(page, { tour: 'keep' })

  const tour = page.getByRole('dialog', { name: 'סיור באפליקציה' })
  await expect(tour).toContainText('היי דנה!')
  for (const title of ['היום', 'מפה', 'הטיול', 'צ׳אט', 'הפרופיל', 'זהו, אתם מוכנים!']) {
    await tour.getByRole('button', { name: /יאללה|הבא/ }).click()
    await expect(tour.getByRole('heading', { level: 2 })).toContainText(title)
  }
  await tour.getByRole('button', { name: 'בואו נתחיל' }).click()
  await expect(tour).toHaveCount(0)

  // Not again after reopening the app.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(tour).toHaveCount(0)

  // But on request.
  await page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()
  await page.getByRole('button', { name: 'סיור קצר באפליקציה' }).click()
  await expect(tour).toContainText('היי דנה!')
  await tour.getByRole('button', { name: 'דלגו' }).click()
  await expect(tour).toHaveCount(0)
})

test('the owner deletes a trip only after typing "מחיקה"', async ({ page }) => {
  await signUp(page, uniqueName('del'))
  await createFirstTrip(page)
  await page.getByRole('button', { name: 'פרופיל והגדרות הטיול' }).click()
  await page.getByRole('button', { name: 'מחיקת הטיול' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'מחיקת הטיול' })
  await expect(confirm).toContainText('אי אפשר לשחזר')
  const remove = confirm.getByRole('button', { name: 'מחיקה לצמיתות' })
  await expect(remove).toBeDisabled()
  await confirm.getByLabel(/הקלידו "מחיקה"/).fill('מחיק')
  await expect(remove).toBeDisabled()
  await confirm.getByLabel(/הקלידו "מחיקה"/).fill('מחיקה')
  await remove.click()
  // No trips left: back to choosing a trip.
  await expect(page.getByRole('button', { name: /טיול חדש משלי/ })).toBeVisible()
})
