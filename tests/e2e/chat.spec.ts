import { expect, test, type Page } from '@playwright/test'
import { createFirstTrip, signUp, uniqueName } from './helpers'

/** Writes local-mode storage and tells the app, as another tab would. */
async function seed(page: Page, update: string) {
  await page.evaluate((code) => {
    const P = 'tabi:v1:'
    const raw = JSON.parse(localStorage.getItem(P + 'trips')!)
    const trip = (Array.isArray(raw) ? raw : Object.values(raw)).at(-1)
    const put = (key: string, value: unknown) => {
      localStorage.setItem(P + key, JSON.stringify(value))
      window.dispatchEvent(new StorageEvent('storage', { key: P + key }))
    }
    const get = (key: string, fallback: unknown) => JSON.parse(localStorage.getItem(P + key) ?? JSON.stringify(fallback))
    new Function('trip', 'raw', 'put', 'get', code)(trip, raw, put, get)
  }, update)
}

/** Holds a finger (the mouse) on a message, as on a phone. */
async function longPress(page: Page, text: string) {
  const box = (await page.getByText(text, { exact: true }).first().boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 5)
  await page.mouse.down()
  await page.waitForTimeout(600)
  await page.mouse.up()
}

test('chat: places, meeting point, poll, reactions, read and typing', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page, uniqueName('chat'))
  await createFirstTrip(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // A second member (Noa), and two saved places.
  await seed(
    page,
    `
    trip.memberIds.push('u2'); trip.members.u2 = { name: 'נועה סעדו', gender: 'female' }; put('trips', raw)
    const places = get('places:' + trip.id, {})
    const p = (id, name, category, lat, lng) => ({ id, name, category, location: { lat, lng }, createdBy: 'x', createdAt: 1, updatedAt: 1 })
    places.ichiran = p('ichiran', 'Ichiran Shibuya', 'food', 35.6612, 139.7016)
    places.shibuya = p('shibuya', 'Shibuya Sky', 'attraction', 35.6585, 139.7022)
    put('places:' + trip.id, places)
  `,
  )
  await page.getByRole('link', { name: /צ׳אט/ }).click()

  // Text, then Noa reads it and starts typing.
  await page.getByLabel('הודעה חדשה').fill('יאללה לאכול ראמן?')
  await page.getByRole('button', { name: 'שליחה' }).click()
  await seed(page, `put('chatMeta:' + trip.id, { read: { u2: Date.now() + 1000 }, typing: { u2: Date.now() } })`)
  await expect(page.getByText('נקרא ע״י נועה')).toBeVisible()
  await expect(page.getByText(/נועה מקלידה/)).toBeVisible()

  // Reaction by long press.
  await longPress(page, 'יאללה לאכול ראמן?')
  await page.getByRole('button', { name: 'תגובה ❤️' }).click()
  await expect(page.getByRole('button', { name: /❤️ 1, כולל שלך/ })).toBeVisible()

  // Reply to it (the quote shows in the answer), then take the original back.
  await longPress(page, 'יאללה לאכול ראמן?')
  await page.getByRole('button', { name: 'תשובה' }).click()
  await expect(page.getByText('תשובה לעצמך')).toBeVisible()
  await page.getByLabel('הודעה חדשה').fill('או סושי')
  await page.getByRole('button', { name: 'שליחה' }).click()
  const answer = page.locator('[id^="message-"]', { hasText: 'או סושי' })
  await expect(answer.getByRole('button', { name: /יאללה לאכול ראמן?/ })).toBeVisible()
  await longPress(page, 'יאללה לאכול ראמן?')
  await page.getByRole('toolbar', { name: 'פעולות על ההודעה' }).getByRole('button', { name: 'מחיקה' }).click()
  await page.getByRole('toolbar', { name: 'פעולות על ההודעה' }).getByRole('button', { name: 'מחיקה' }).click()
  await expect(page.getByText('מחקת את ההודעה הזו')).toBeVisible()
  await expect(answer.getByText('ההודעה נמחקה')).toBeVisible()

  // Share a place.
  await page.getByRole('button', { name: 'שיתוף מקום, נקודת מפגש או סקר' }).click()
  await page.getByRole('button', { name: /^מקום/ }).click()
  await page.getByRole('button', { name: 'Ichiran Shibuya' }).click()
  await page.getByLabel('הודעה חדשה').fill('מה דעתכן?')
  await page.getByRole('button', { name: 'שליחה' }).click()
  await expect(page.getByRole('button', { name: /Ichiran Shibuya/ })).toBeVisible()

  // A poll with a saved place as an option, and a vote.
  await page.getByRole('button', { name: 'שיתוף מקום, נקודת מפגש או סקר' }).click()
  await page.getByRole('button', { name: /^סקר/ }).click()
  await page.getByLabel('השאלה').fill('איפה אוכלים הערב?')
  await page.getByLabel('אפשרות 1').fill('סושי')
  await page.getByRole('dialog').getByRole('button', { name: 'Ichiran Shibuya' }).click()
  await page.getByRole('button', { name: 'שליחת הסקר' }).click()
  await page.getByRole('button', { name: /סושי/ }).click()
  await expect(page.getByText('הצבעה אחת מתוך 2')).toBeVisible()

  // A meeting point at a saved place: pinned at the top.
  await page.getByRole('button', { name: 'שיתוף מקום, נקודת מפגש או סקר' }).click()
  await page.getByRole('button', { name: /^נקודת מפגש/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Shibuya Sky' }).click()
  await page.getByLabel('הערה (לא חובה)').fill('ליד הכניסה')
  await page.getByRole('button', { name: 'שליחה לצ׳אט' }).click()
  await expect(page.getByRole('region', { name: 'נקודת מפגש' })).toContainText('Shibuya Sky')

  // The shared place opens.
  await page
    .getByRole('button', { name: /Ichiran Shibuya/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Ichiran Shibuya' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Today shows the meeting point too.
  await page.getByRole('link', { name: 'היום' }).click()
  await expect(page.getByRole('region', { name: 'נקודת מפגש' })).toBeVisible()
})
