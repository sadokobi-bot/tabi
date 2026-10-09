import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { firstName } from '@/backend'
import { Button } from '@/components/ui/Button'
import { hasFirebase } from '@/config/env'
import { useCurrentUser } from '@/store/session'
import { finishTour, useTour, type TourId } from '@/store/tour'
import { ui } from '@/store/ui'

/** What a step points at: a bottom tab (by position), an element marked data-tour="…", or nothing. */
type Target = { tab: number } | { mark: string; round?: boolean } | null

interface Step {
  target: Target
  title: string
  text: string
}

const welcomeSteps = (name: string): Step[] => [
  { target: null, title: `היי ${name}! 👋`, text: 'אני החתול של Tabi. בואו נעשה סיבוב קצר באפליקציה, זה לוקח חצי דקה.' },
  { target: { tab: 0 }, title: 'היום', text: 'כל מה שחשוב היום: מזג האוויר, הדבר הבא בלו״ז, המלון והכרטיסים.' },
  {
    target: { tab: 1 },
    title: 'מפה',
    text: 'מחפשים ושומרים מקומות, רואים המלצות באזור, ו״צריך עכשיו״ מוצא שירותים, כספומט ועוד.',
  },
  { target: { tab: 2 }, title: 'הטיול', text: 'הלו״ז יום אחרי יום. גוררים מקומות לימים, ו״תכננו לי את היום״ בונה יום שלם.' },
  { target: { tab: 3 }, title: 'צ׳אט', text: 'מדברים עם השותפים לטיול, משתפים מקומות, קובעים נקודת מפגש ופותחים סקר.' },
  { target: { mark: 'profile', round: true }, title: 'הפרופיל', text: 'כאן קוד ההזמנה לשותפים, הטיסות וכל ההגדרות של הטיול.' },
  { target: null, title: 'זהו, אתם מוכנים! 🎌', text: 'טיול מהנה ביפן. אם תצטרכו, אפשר לראות את הסיור הזה שוב מהפרופיל.' },
]

const mapSteps = (): Step[] =>
  (
    [
      {
        target: null,
        title: 'ברוכים הבאים למפה! 🗺️',
        text: 'כאן מוצאים, שומרים ומנווטים לכל מקום ביפן. בואו נעבור על כל מה שיש פה, זה לוקח דקה.',
      },
      {
        target: { mark: 'map-search' },
        title: 'חיפוש',
        text: 'מקלידים שם של מקום, שכונה או סוג מקום (״ראמן״, ״שיבויה״) ובוחרים מהרשימה. המקום נפתח עם תמונות, שעות פתיחה ודירוג.',
      },
      {
        target: { mark: 'categories' },
        title: 'המלצות באזור',
        text: 'בוחרים קטגוריה (אוכל, אטרקציות, קניות…) ובמפה מופיעים המקומות הכי מומלצים באזור שמוצג. סיכה עם מסגרת היא המלצה, סיכה מלאה היא מקום ששמרתם.',
      },
      {
        target: { mark: 'saved-chip' },
        title: 'המקומות שלכם',
        text: 'מציג או מסתיר במפה את כל המקומות ששמרתם בטיול. המספר הוא כמה מקומות שמרתם.',
      },
      {
        target: { mark: 'needs-chip' },
        title: 'צריך עכשיו',
        text: 'שירותים, כספומט, מכולת, תחנת רכבת, בית מרקחת ועוד: לחיצה אחת מראה את הכי קרובים אליכם, עם זמן הליכה וכפתור ניווט.',
      },
      hasFirebase && {
        target: { mark: 'assistant', round: true },
        title: 'העוזר החכם ✨',
        text: 'מתארים במילים (״המקדש עם אלפי השערים הכתומים״) או מדביקים פוסט או צילום מסך מאינסטגרם, והעוזר מוצא את המקומות ושומר אותם בשבילכם.',
      },
      hasFirebase && {
        target: { mark: 'people', round: true },
        title: 'איפה כולם',
        text: 'רואים במפה את השותפים לטיול שבחרו לשתף מיקום, ומשתפים את שלכם. שימושי כשמתפצלים.',
      },
      {
        target: { mark: 'locate', round: true },
        title: 'המיקום שלי',
        text: 'מקפיץ את המפה אליכם ועוקב אחריכם בזמן ההליכה. אותו הדבר קורה כשלוחצים על הלשונית ״מפה״ כשאתם כבר בה.',
      },
      {
        target: { mark: 'add-place', round: true },
        title: 'מקום משלכם',
        text: 'מקום שלא מופיע בחיפוש? לוחצים על +, מזיזים את המפה עד שהסיכה עליו ושומרים. אפשר גם לחיצה ארוכה על המפה עצמה.',
      },
      {
        target: null,
        title: 'לחיצה על סיכה',
        text: 'פותחת את כרטיס המקום: שמירה, שיבוץ ביום בטיול, כרטיסים ומחירים, שיתוף בצ׳אט, ו״קח אותי לשם״ לניווט.',
      },
      { target: null, title: 'בהצלחה! 🎌', text: 'עכשיו המפה כולה שלכם. אפשר לראות את הסיור הזה שוב מהפרופיל.' },
    ] as (Step | false)[]
  ).filter((step): step is Step => Boolean(step))

const TOURS: Record<TourId, { label: string; image: string; path: string }> = {
  welcome: { label: 'סיור באפליקציה', image: 'guide.png', path: '/' },
  map: { label: 'סיור במפה', image: 'map.png', path: '/map' },
}

/** The element a step points at, if it's on screen (inactive tabs keep their screens, hidden). */
function findTarget(target: Target): Element | null {
  if (!target) return null
  if ('tab' in target) return document.querySelectorAll('nav[aria-label="ניווט ראשי"] a')[target.tab] ?? null
  return (
    [...document.querySelectorAll(`[data-tour="${target.mark}"]`)].find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility === 'visible'
    }) ?? null
  )
}

/** The target's box, kept up to date (the map's controls appear and move as it loads). */
function useTargetRect(target: Target): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    let last = ''
    const measure = () => {
      const box = findTarget(target)?.getBoundingClientRect() ?? null
      // Inside the screen (a scrolling row of chips runs past its edge).
      const left = box ? Math.max(box.left, 8) : 0
      const right = box ? Math.min(box.right, window.innerWidth - 8) : 0
      const next = box ? new DOMRect(left, box.top, Math.max(0, right - left), box.height) : null
      const signature = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.width)},${Math.round(next.height)}` : ''
      if (signature !== last) {
        last = signature
        setRect(next)
      }
    }
    measure()
    const timer = setInterval(measure, 300)
    window.addEventListener('resize', measure)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', measure)
    }
  }, [target])
  return rect
}

/** The tours: the cat walks the user through the app, or through the map, in short steps. */
export function Tour() {
  const open = useTour((state) => state.open)
  return createPortal(<AnimatePresence>{open && <TourSteps key={open} tour={open} />}</AnimatePresence>, document.body)
}

function TourSteps({ tour }: { tour: TourId }) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const name = firstName(user)
  const config = TOURS[tour]
  // Built once: each step's target is an object the highlight effect depends on.
  const all = useMemo(() => (tour === 'welcome' ? welcomeSteps(name) : mapSteps()), [tour, name])
  const [index, setIndex] = useState(0)
  const step = all[index]!
  const last = index === all.length - 1
  const rect = useTargetRect(step.target)

  // Told on its own screen, with nothing in front of what it points at.
  useEffect(() => {
    navigate(config.path)
    ui.closeSheet()
    if (tour === 'map') ui.clearRoute()
    // Once, when the tour opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && finishTour(user.uid)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user.uid])

  const next = () => (last ? finishTour(user.uid) : setIndex((i) => i + 1))
  const round = Boolean(step.target && 'round' in step.target && step.target.round)
  const pad = round ? 6 : 4
  // The card sits on the far side of what's highlighted, or in the middle when nothing is.
  const below = rect && rect.top + rect.height / 2 < window.innerHeight / 2

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={config.label}
      className="fixed inset-0 z-[70]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {rect ? (
        <motion.div
          aria-hidden
          className={clsx('pointer-events-none absolute ring-2 ring-white/85', round ? 'rounded-full' : 'rounded-2xl')}
          initial={false}
          animate={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          style={{ boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.62)' }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/62" />
      )}

      <div
        className={clsx('absolute inset-x-4 mx-auto max-w-sm', !rect && 'top-1/2 -translate-y-1/2')}
        style={rect ? (below ? { top: rect.bottom + 84 } : { bottom: window.innerHeight - rect.top + 20 }) : undefined}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="surface relative rounded-card p-5 pt-6 shadow-2xl"
          >
            <motion.img
              src={`${import.meta.env.BASE_URL}mascot/${config.image}`}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute -top-[4.5rem] end-3 size-24 select-none"
              style={{ originY: 1 }}
              animate={{ y: [0, -4, 0], rotate: [0, -2, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <h2 className="pe-20 text-lg font-bold tracking-tight">{step.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex flex-1 flex-wrap gap-1.5" aria-label={`שלב ${index + 1} מתוך ${all.length}`}>
                {all.map((_, dot) => (
                  <span
                    key={dot}
                    className={clsx('h-1.5 rounded-full transition-all', dot === index ? 'w-4 bg-accent-fill' : 'w-1.5 bg-fg/15')}
                  />
                ))}
              </div>
              {!last && (
                <Button variant="ghost" onClick={() => finishTour(user.uid)}>
                  דלגו
                </Button>
              )}
              <Button onClick={next} autoFocus>
                {index === 0 ? 'יאללה' : last ? 'בואו נתחיל' : 'הבא'}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
