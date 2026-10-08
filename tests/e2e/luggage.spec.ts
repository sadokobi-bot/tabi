import { expect, test } from '@playwright/test'
import { createFirstTrip, signUp, uniqueName } from './helpers'

test('moving hotels: send the suitcases ahead, with a card in Japanese for the front desk', async ({ page }) => {
  await signUp(page, uniqueName('lug'))
  await createFirstTrip(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Two hotels: tonight in Tokyo, tomorrow in Kyoto.
  await page.evaluate(() => {
    const P = 'tabi:v1:'
    const raw = JSON.parse(localStorage.getItem(P + 'trips')!)
    const list = Array.isArray(raw) ? raw : Object.values(raw)
    const trip = list[list.length - 1]
    const iso = (offset: number) => {
      const d = new Date(Date.now() + offset * 86400000)
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(d)
    }
    const hotel = (id: string, name: string, lat: number, lng: number, extra = {}) => ({
      id,
      name,
      category: 'hotel',
      location: { lat, lng },
      createdBy: 'x',
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    })
    const places = JSON.parse(localStorage.getItem(P + `places:${trip.id}`) ?? '{}')
    places.hA = hotel('hA', 'Hotel Gracery Shinjuku', 35.6948, 139.7016)
    places.hB = hotel('hB', 'Hotel Granvia Kyoto', 34.9858, 135.7588, {
      hotel: {
        addressJa: '〒600-8216 京都府京都市下京区烏丸通塩小路下ル東塩小路町901',
        phone: '075-344-8888',
        code: 'BK-48213',
        checkIn: '15:00',
      },
    })
    localStorage.setItem(P + `places:${trip.id}`, JSON.stringify(places))
    trip.stays = { [iso(0)]: 'hA', [iso(1)]: 'hB' }
    localStorage.setItem(P + 'trips', JSON.stringify(raw))
  })
  await page.reload()
  const row = page.getByRole('button', { name: /שולחים את המזוודות הערב/ })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.scrollIntoViewIfNeeded()
  await row.click()
  await page.getByLabel(/השם שלכם באנגלית/).fill('NOA LEVI')
  await page.getByRole('button', { name: 'כרטיס ביפנית לקבלה' }).click()
  await page.getByRole('dialog', { name: 'כרטיס ביפנית לקבלה' }).getByRole('button', { name: 'סגירה' }).click()
  await page.getByLabel(/מספר מעקב/).fill('4321-5678-9012')
  await page.getByRole('button', { name: 'נשלח', exact: true }).click()
  await expect(page.getByText(/המזוודות בדרך אל/).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /המזוודות בדרך אל Hotel Granvia/ })).toBeVisible()
  // The guest name is remembered on this device.
  await page.getByRole('button', { name: /המזוודות בדרך אל Hotel Granvia/ }).click()
  await expect(page.getByLabel(/השם שלכם באנגלית/)).toHaveValue('NOA LEVI')
})
