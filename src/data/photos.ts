/** A photo for the Today card (Unsplash, in public/photos/), and the place it shows. */
export interface CityPhoto {
  id: string
  /** Shown on the card: where the photo was taken. */
  place: string
  /** Cities (ids in cities.ts) it stands for. */
  cities: string[]
  /** Shown first on a day whose stops include this place. */
  match?: RegExp
  /** An evening or night shot (preferred after dark). */
  night?: boolean
  /** CSS object-position: keeps the subject in view where the card crops the photo. */
  focus?: string
}

export const PHOTOS: CityPhoto[] = [
  { id: 'shibuya-crossing', place: 'מעבר החצייה בשיבויה', cities: ['tokyo'], match: /shibuya|שיבויה/i },
  { id: 'shibuya', place: 'שיבויה, טוקיו', cities: ['tokyo'], match: /shibuya|שיבויה/i },
  { id: 'shibuya-night', place: 'שיבויה בלילה', cities: ['tokyo'], night: true, match: /shibuya|שיבויה/i },
  { id: 'tokyo-tower', place: 'מגדל טוקיו', cities: ['tokyo'], night: true, match: /tokyo tower|מגדל טוקיו/i, focus: '30% 50%' },
  { id: 'disneyland', place: 'טוקיו דיסנילנד', cities: [], match: /disney|דיסני/i },
  { id: 'fushimi-inari', place: 'פושימי אינארי, קיוטו', cities: ['kyoto'], match: /inari|אינארי/i },
  { id: 'kiyomizu', place: 'קיומיזו-דרה, קיוטו', cities: ['kyoto'], match: /kiyomizu|קיומיזו/i, focus: '80% 50%' },
  { id: 'shinsekai', place: 'שינסקאי, אוסקה', cities: ['osaka'], match: /shinsekai|tsutenkaku|שינסקאי/i },
  { id: 'super-nintendo-world', place: 'סופר נינטנדו וורלד, יוניברסל', cities: [], match: /universal|nintendo|\busj\b|יוניברסל|נינטנדו/i },
  { id: 'nara-deer', place: 'הצבאים של נארה', cities: ['nara'], match: /nara park|פארק נארה/i, focus: '70% 50%' },
  { id: 'nara-torii', place: 'שער טוריי בנארה', cities: ['nara'] },
  { id: 'chureito', place: 'פגודת צ׳ורייטו והר פוג׳י', cities: ['kawaguchiko'], match: /chureito|צ׳ורייטו|צורייטו/i },
  { id: 'chureito-dusk', place: 'פגודת צ׳ורייטו והר פוג׳י', cities: ['kawaguchiko'], night: true },
  { id: 'fuji', place: 'הר פוג׳י', cities: ['kawaguchiko', 'hakone'] },
  {
    id: 'itsukushima',
    place: 'השער הצף באיצוקושימה',
    cities: ['miyajima', 'hiroshima'],
    match: /itsukushima|miyajima|איצוקושימה|מיאג׳ימה/i,
  },
  { id: 'kabira-bay', place: 'מפרץ קבירה, אישיגאקי', cities: ['okinawa'], match: /kabira|ishigaki|קבירה|אישיגאקי/i },
  { id: 'okinawa-beach', place: 'חוף באוקינאווה', cities: ['okinawa'] },
  { id: 'okinawa-coast', place: 'חוף באוקינאווה', cities: ['okinawa'] },
  { id: 'nachi', place: 'מפל נאצ׳י וסייגאנטו-ג׳י', cities: [], match: /nachi|נאצ׳י/i, focus: '35% 50%' },
]

/** For a city without photos of its own: a Japan scene (its own place name shows on it). */
const ELSEWHERE = ['nachi', 'fuji', 'chureito', 'kiyomizu']

const BY_ID = new Map(PHOTOS.map((photo) => [photo.id, photo]))

export const photoUrl = (photo: CityPhoto) => `${import.meta.env.BASE_URL}photos/${photo.id}.webp`

/**
 * Today's photo: a landmark on today's plan if there's a photo of it; otherwise one of the city's
 * (an evening shot after dark when there is one), a different one each day.
 */
export function photoFor({ cityId, stops, day, night }: { cityId?: string; stops: string[]; day: number; night: boolean }): CityPhoto {
  const landmark = PHOTOS.find((photo) => photo.match && stops.some((name) => photo.match!.test(name)))
  if (landmark) return landmark
  const own = cityId ? PHOTOS.filter((photo) => photo.cities.includes(cityId)) : []
  const timely = own.filter((photo) => !!photo.night === night)
  const pool = timely.length ? timely : own.length ? own : ELSEWHERE.map((id) => BY_ID.get(id)!)
  return pool[((day % pool.length) + pool.length) % pool.length]!
}
