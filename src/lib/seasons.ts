import { addDays } from './dates'

/** Something about the time of year in Japan: worth planning around, or worth knowing. */
export interface SeasonEvent {
  id: string
  emoji: string
  /** Hebrew title and one practical line. */
  title: string
  note: string
  /** For the planner, in English. */
  en: string
  /** Usual dates, MM-DD (inclusive; may wrap the new year). */
  from: string
  to: string
  /** highlight: something to see (they choose whether to build it in); heads-up: worth knowing. */
  kind: 'highlight' | 'heads-up'
}

/** Usual dates; blossom and foliage move a week or two with the weather and differ by region. */
export const SEASON_EVENTS: SeasonEvent[] = [
  {
    id: 'plum',
    emoji: '🌺',
    title: 'פריחת השזיפים',
    note: 'מבשרת את האביב: גני שזיפים פורחים בטוקיו ובקיוטו',
    en: 'plum blossom season (ume): plum gardens such as Yushima Tenjin, Kitano Tenmangu, Kairakuen',
    from: '02-10',
    to: '03-10',
    kind: 'highlight',
  },
  {
    id: 'snow-festival',
    emoji: '❄️',
    title: 'פסטיבל השלג בסאפורו',
    note: 'פסלי שלג וקרח ענקיים במרכז סאפורו',
    en: 'Sapporo Snow Festival (early February) in Sapporo',
    from: '02-04',
    to: '02-11',
    kind: 'highlight',
  },
  {
    id: 'sakura',
    emoji: '🌸',
    title: 'פריחת הדובדבן (סאקורה)',
    note: 'השיא בטוקיו, קיוטו ואוסקה בסוף מרץ ותחילת אפריל. הנאמי בפארקים, ותצפיות לילה מוארות',
    en: 'cherry blossom season (sakura): hanami spots in bloom such as Ueno Park, Shinjuku Gyoen, Chidorigafuchi, Meguro River, Philosopher’s Path, Maruyama Park, Osaka Castle Park; evening light-ups',
    from: '03-22',
    to: '04-12',
    kind: 'highlight',
  },
  {
    id: 'wisteria',
    emoji: '💜',
    title: 'פריחת הוויסטריה',
    note: 'מנהרות של פרחים סגולים, למשל בפארק אשיקאגה',
    en: 'wisteria season: Ashikaga Flower Park, Kameido Tenjin',
    from: '04-20',
    to: '05-10',
    kind: 'highlight',
  },
  {
    id: 'golden-week',
    emoji: '🎌',
    title: 'גולדן ויק',
    note: 'שבוע חגים ביפן: עומס גדול באטרקציות וברכבות, ומלונות מתייקרים',
    en: 'Golden Week (Japanese holidays): very crowded sights and trains, book ahead, go early',
    from: '04-29',
    to: '05-05',
    kind: 'heads-up',
  },
  {
    id: 'rainy',
    emoji: '☔',
    title: 'עונת הגשמים',
    note: 'הרבה ימים גשומים. מצד שני, פריחת ההידרנגאה יפהפייה (למשל בקמאקורה)',
    en: 'rainy season (tsuyu): keep indoor options each day; hydrangea gardens in bloom (Meigetsu-in, Hase-dera in Kamakura)',
    from: '06-05',
    to: '07-15',
    kind: 'heads-up',
  },
  {
    id: 'summer-festivals',
    emoji: '🎆',
    title: 'פסטיבלי קיץ וזיקוקים',
    note: 'גיון מצוּרי בקיוטו כל יולי, טנג׳ין מצורי באוסקה ב-24–25 ביולי, ומופעי זיקוקים',
    en: 'summer festival season: Gion Matsuri in Kyoto (July, parades 17 and 24 July), Tenjin Matsuri in Osaka (24-25 July), fireworks festivals (Sumida River in late July); yukata evenings',
    from: '07-01',
    to: '08-20',
    kind: 'highlight',
  },
  {
    id: 'heat',
    emoji: '🥵',
    title: 'קיץ חם ולח',
    note: 'חום כבד בצהריים: כדאי לטייל בבוקר ובערב, ומקומות ממוזגים באמצע היום',
    en: 'hot, humid summer: outdoor sights early morning and evening, indoor and air-conditioned places at midday',
    from: '07-10',
    to: '09-05',
    kind: 'heads-up',
  },
  {
    id: 'obon',
    emoji: '🏮',
    title: 'אובון',
    note: 'חג משפחתי: רכבות עמוסות מאוד, וחלק מהעסקים הקטנים סגורים. בקיוטו נדלקות מדורות הדאימונג׳י ב-16 באוגוסט',
    en: 'Obon week: crowded trains, some small businesses closed; Gozan no Okuribi bonfires in Kyoto on 16 August',
    from: '08-11',
    to: '08-17',
    kind: 'heads-up',
  },
  {
    id: 'typhoon',
    emoji: '🌀',
    title: 'עונת הטייפונים',
    note: 'ייתכנו ימים סוערים. כדאי להשאיר גמישות ותוכנית חלופית',
    en: 'typhoon season: keep plans flexible with indoor backups',
    from: '08-15',
    to: '09-30',
    kind: 'heads-up',
  },
  {
    id: 'halloween',
    emoji: '🎃',
    title: 'ליל כל הקדושים בשיבויה',
    note: 'המוני אנשים מחופשים ברחובות שיבויה (בשנים האחרונות העירייה מבקשת לא להגיע)',
    en: 'Halloween crowds in Shibuya on 31 October (the city discourages visiting)',
    from: '10-30',
    to: '10-31',
    kind: 'heads-up',
  },
  {
    id: 'foliage',
    emoji: '🍁',
    title: 'שלכת (קוֹיוֹ)',
    note: 'העלים מאדימים: השיא בטוקיו ובקיוטו בסוף נובמבר ותחילת דצמבר, בהוקאידו ובהרים כבר באוקטובר',
    en: 'autumn foliage (koyo): momiji spots such as Tofuku-ji, Eikando and Arashiyama in Kyoto, Rikugien and Icho Namiki in Tokyo, Nikko and Hakone earlier; evening light-ups',
    from: '10-20',
    to: '12-08',
    kind: 'highlight',
  },
  {
    id: 'illuminations',
    emoji: '✨',
    title: 'תאורות החורף',
    note: 'רחובות וגנים מוארים באלפי אורות, בעיקר בערבים',
    en: 'winter illumination season: Marunouchi, Roppongi Hills, Tokyo Midtown, Yomiuriland, Kobe Luminarie; plan evening light-ups',
    from: '11-15',
    to: '02-14',
    kind: 'highlight',
  },
  {
    id: 'new-year',
    emoji: '🎍',
    title: 'ראש השנה היפני',
    note: 'הרבה עסקים ומוזיאונים סגורים ב-29 בדצמבר עד 3 בינואר, והמקדשים מלאים במבקרים שבאים לברך על השנה החדשה (הָאטסוּמוֹדֶה)',
    en: 'Japanese New Year: many shops, museums and restaurants closed 29 Dec - 3 Jan; shrines very crowded for hatsumode (Meiji Jingu, Fushimi Inari)',
    from: '12-29',
    to: '01-03',
    kind: 'heads-up',
  },
]

/** Day of year-ish number for an MM-DD (good enough for overlaps). */
const ordinal = (mmdd: string) => Number(mmdd.slice(0, 2)) * 31 + Number(mmdd.slice(3, 5))

/** The events that fall within the trip's dates, in the order they come up. */
export function seasonFor(startDate: string, days: number): SeasonEvent[] {
  const dates = Array.from({ length: Math.max(1, days) }, (_, i) => addDays(startDate, i).slice(5))
  const inRange = (event: SeasonEvent, mmdd: string) => {
    const at = ordinal(mmdd)
    const from = ordinal(event.from)
    const to = ordinal(event.to)
    return from <= to ? at >= from && at <= to : at >= from || at <= to
  }
  return SEASON_EVENTS.map((event) => ({ event, first: dates.findIndex((mmdd) => inRange(event, mmdd)) }))
    .filter(({ first }) => first >= 0)
    .sort((a, b) => a.first - b.first)
    .map(({ event }) => event)
}
