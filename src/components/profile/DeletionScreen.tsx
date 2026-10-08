import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, CircleCheckBig, KeyRound, LoaderCircle, Luggage, MapPin, MessageCircle, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { DeletePhase } from '@/backend'
import { Button } from '@/components/ui/Button'
import { closeDeletion, useDeletion } from '@/store/deletion'

const PHASES: { phase: DeletePhase; label: string; icon: LucideIcon }[] = [
  { phase: 'chat', label: 'הצ׳אט', icon: MessageCircle },
  { phase: 'invite', label: 'קוד ההזמנה', icon: KeyRound },
  { phase: 'places', label: 'המקומות, הלו״ז והכרטיסים', icon: MapPin },
  { phase: 'trip', label: 'הטיול עצמו', icon: Luggage },
]

/** Each line is checked off at least this long after the one before, so the steps read as steps. */
const TICK_MS = 550
const SUCCESS_MS = 1900

/** Bits of eraser rubbing off the list while the cat works. */
function Crumbs() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-[62%] left-[31%]">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <motion.span
          key={index}
          className={clsx('absolute size-1.5 rounded-full', index % 2 ? 'bg-pink-300' : 'bg-neutral-400')}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, (index - 2.5) * 7], y: [0, 26 + (index % 3) * 8], opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15, ease: 'easeOut' }}
        />
      ))}
    </span>
  )
}

/**
 * Full screen while a trip is deleted: the cat erasing its list, each part checked off as it goes,
 * then "deleted" and on to the welcome screen. Lives above the app, which changes under it.
 */
export function DeletionScreen() {
  const trip = useDeletion((state) => state.trip)
  return createPortal(<AnimatePresence>{trip && <Deleting key={trip.id} name={trip.name} />}</AnimatePresence>, document.body)
}

function Deleting({ name }: { name: string }) {
  const done = useDeletion((state) => state.done)
  const finished = useDeletion((state) => state.finished)
  const error = useDeletion((state) => state.error)
  const [shown, setShown] = useState(0)
  const [success, setSuccess] = useState(false)

  // Tick the steps off one by one, never faster than TICK_MS apart.
  useEffect(() => {
    if (shown >= done.length) return
    const timer = setTimeout(() => setShown((count) => count + 1), TICK_MS)
    return () => clearTimeout(timer)
  }, [shown, done.length])

  useEffect(() => {
    if (!finished || shown < PHASES.length) return
    const timer = setTimeout(() => setSuccess(true), 350)
    return () => clearTimeout(timer)
  }, [finished, shown])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(closeDeletion, SUCCESS_MS)
    return () => clearTimeout(timer)
  }, [success])

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-label="מוחקים את הטיול"
      aria-busy={!success && !error}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-bg px-8 pb-[env(safe-area-inset-bottom)] text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="relative size-56">
        {/* Two frames of the same drawing: the list whole, and erased. It fades from one to the other
            as the parts are deleted. */}
        <motion.div
          className="relative size-full"
          style={{ originY: 1 }}
          animate={success || error ? { rotate: 0, x: 0 } : { rotate: [0, -1.5, 0, 1.5, 0], x: [0, -1.5, 0, 1.5, 0] }}
          transition={success || error ? { duration: 0.3 } : { duration: 0.45, repeat: Infinity, ease: 'easeInOut' }}
        >
          {['delete-1', 'delete-2'].map((frame, index) => (
            <motion.img
              key={frame}
              src={`${import.meta.env.BASE_URL}mascot/${frame}.png`}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 size-full object-contain select-none"
              initial={false}
              animate={{ opacity: index === 0 ? 1 : success ? 1 : shown / PHASES.length }}
              transition={{ duration: 0.5 }}
            />
          ))}
        </motion.div>
        {!success && !error && <Crumbs />}
        <AnimatePresence>
          {success && (
            <motion.span
              aria-hidden
              className="absolute -top-1 end-2 grid size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            >
              <Check className="size-8" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <h1 role="status" className="mt-5 text-[1.6rem] leading-tight font-bold tracking-tight">
        {error ? 'המחיקה נעצרה' : success ? 'הטיול נמחק' : 'מוחקים את הטיול…'}
      </h1>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        {error ? error : success ? 'הכול נוקה. אפשר להתחיל טיול חדש' : <bdi>״{name}״</bdi>}
      </p>

      {!success && (
        <ul className="mt-6 w-full max-w-64 space-y-2.5 text-start">
          {PHASES.map(({ phase, label, icon: Icon }, index) => {
            const ticked = index < shown
            const current = index === shown && !error
            return (
              <li key={phase} className={clsx('flex items-center gap-3 text-sm transition-opacity', !ticked && !current && 'opacity-40')}>
                <span
                  className={clsx(
                    'grid size-7 shrink-0 place-items-center rounded-full transition-colors',
                    ticked ? 'bg-emerald-500 text-white' : 'bg-fg/8 text-muted',
                  )}
                >
                  {ticked ? (
                    <Check aria-hidden className="size-4" strokeWidth={3} />
                  ) : current ? (
                    <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Icon aria-hidden className="size-3.5" />
                  )}
                </span>
                <span className={clsx(ticked && 'text-muted line-through decoration-1')}>{label}</span>
              </li>
            )
          })}
        </ul>
      )}

      {success && (
        <motion.p
          className="mt-6 flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CircleCheckBig aria-hidden className="size-4.5" />
          ממשיכים…
        </motion.p>
      )}

      {error && (
        <Button className="mt-6" onClick={closeDeletion}>
          חזרה
        </Button>
      )}
    </motion.div>
  )
}
