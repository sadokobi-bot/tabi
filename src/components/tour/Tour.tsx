import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { firstName } from '@/backend'
import { Button } from '@/components/ui/Button'
import { useCurrentUser } from '@/store/session'
import { finishTour, useTour } from '@/store/tour'

type Target = { tab: number } | 'profile' | null

interface Step {
  target: Target
  title: string
  text: string
}

const steps = (name: string): Step[] => [
  { target: null, title: `היי ${name}! 👋`, text: 'אני החתול של Tabi. בואו נעשה סיבוב קצר באפליקציה, זה לוקח חצי דקה.' },
  { target: { tab: 0 }, title: 'היום', text: 'כל מה שחשוב היום: מזג האוויר, הדבר הבא בלו״ז, המלון והכרטיסים.' },
  {
    target: { tab: 1 },
    title: 'מפה',
    text: 'מחפשים ושומרים מקומות, רואים המלצות באזור, ו״צריך עכשיו״ מוצא שירותים, כספומט ועוד.',
  },
  { target: { tab: 2 }, title: 'הטיול', text: 'הלו״ז יום אחרי יום. גוררים מקומות לימים, ו״תכננו לי את היום״ בונה יום שלם.' },
  { target: { tab: 3 }, title: 'צ׳אט', text: 'מדברים עם השותפים לטיול, משתפים מקומות, קובעים נקודת מפגש ופותחים סקר.' },
  { target: 'profile', title: 'הפרופיל', text: 'כאן קוד ההזמנה לשותפים, הטיסות וכל ההגדרות של הטיול.' },
  { target: null, title: 'זהו, אתם מוכנים! 🎌', text: 'טיול מהנה ביפן. אם תצטרכו, אפשר לראות את הסיור הזה שוב מהפרופיל.' },
]

/** The element a step points at, if it's on screen (inactive tabs keep their screens, hidden). */
function findTarget(target: Target): Element | null {
  if (!target) return null
  if (target === 'profile')
    return (
      [...document.querySelectorAll('button[aria-label="פרופיל והגדרות הטיול"]')].find(
        (element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility === 'visible',
      ) ?? null
    )
  return document.querySelectorAll('nav[aria-label="ניווט ראשי"] a')[target.tab] ?? null
}

function useTargetRect(target: Target): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    const measure = () => setRect(findTarget(target)?.getBoundingClientRect() ?? null)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [target])
  return rect
}

/** The welcome tour: the cat walks a new user through the main screens in a few short steps. */
export function Tour() {
  const open = useTour((state) => state.open)
  return createPortal(<AnimatePresence>{open && <TourSteps />}</AnimatePresence>, document.body)
}

function TourSteps() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const name = firstName(user)
  // Built once: each step's target is an object the highlight effect depends on.
  const all = useMemo(() => steps(name), [name])
  const [index, setIndex] = useState(0)
  const step = all[index]!
  const last = index === all.length - 1
  const rect = useTargetRect(step.target)

  // The tour is told from the Today screen (its tabs and the profile button are there).
  useEffect(() => {
    navigate('/')
    // Once, when the tour opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && finishTour(user.uid)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user.uid])

  const next = () => (last ? finishTour(user.uid) : setIndex((i) => i + 1))
  const pad = step.target === 'profile' ? 6 : 4
  // The card sits on the far side of what's highlighted, or in the middle when nothing is.
  const below = rect && rect.top < window.innerHeight / 2

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="סיור באפליקציה"
      className="fixed inset-0 z-[70]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {rect ? (
        <motion.div
          aria-hidden
          className={clsx('pointer-events-none absolute ring-2 ring-white/85', step.target === 'profile' ? 'rounded-full' : 'rounded-2xl')}
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
              src={`${import.meta.env.BASE_URL}mascot/guide.png`}
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
              <div className="flex flex-1 gap-1.5" aria-label={`שלב ${index + 1} מתוך ${all.length}`}>
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
