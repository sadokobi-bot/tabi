import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, SunMedium, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { deleteTicket, loadTicketPages } from '@/data/tickets'
import type { Ticket } from '@/data/types'
import { useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'

/** Keeps the screen on while the ticket is shown (the gate scanner takes a moment). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let released = false
    navigator.wakeLock.request('screen').then(
      (sentinel) => (released ? void sentinel.release() : (lock = sentinel)),
      () => undefined,
    )
    return () => {
      released = true
      void lock?.release()
    }
  }, [active])
}

/** The ticket full screen, on white, ready to be scanned. */
export function TicketViewer() {
  const ticket = useUi((state) => state.ticket)
  useWakeLock(Boolean(ticket))

  // Above everything, the place sheet it's opened from included.
  return createPortal(<AnimatePresence>{ticket && <TicketScreen key={ticket.id} ticket={ticket} />}</AnimatePresence>, document.body)
}

function TicketScreen({ ticket }: { ticket: Ticket }) {
  const place = useTripStore((state) => state.placesById[ticket.placeId])
  const [pages, setPages] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoomed, setZoomed] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadTicketPages(ticket).then(
      (loaded) => !cancelled && (loaded.length && loaded.every(Boolean) ? setPages(loaded) : setFailed(true)),
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [ticket])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && ui.openTicket(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`כרטיס: ${ticket.name}`}
      className="fixed inset-0 z-[60] flex flex-col bg-white text-neutral-900"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.22 }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <button
          type="button"
          aria-label="סגירה"
          onClick={() => ui.openTicket(null)}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 active:scale-90"
        >
          <X aria-hidden className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold" dir="auto">
            {place?.name ?? ticket.name}
          </p>
          {place && (
            <p className="truncate text-xs text-neutral-500" dir="auto">
              {ticket.name}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="מחיקת הכרטיס"
          onClick={() => setConfirmDelete(true)}
          className="grid size-10 shrink-0 place-items-center rounded-full text-red-600 active:scale-90"
        >
          <Trash2 aria-hidden className="size-5" />
        </button>
      </header>

      {confirmDelete && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-red-50 px-4 py-3">
          <span className="text-sm font-medium">למחוק את הכרטיס לכל המטיילים?</span>
          <Button
            variant="danger"
            onClick={() => {
              deleteTicket(ticket)
              ui.openTicket(null)
            }}
          >
            מחיקה
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            ביטול
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {!pages && !failed && (
          <div className="grid h-full place-items-center">
            <LoaderCircle aria-label="טוען את הכרטיס" className="size-7 animate-spin text-neutral-400" />
          </div>
        )}
        {failed && (
          <p className="grid h-full place-items-center px-8 text-center text-sm text-neutral-500">
            הכרטיס עוד לא הגיע לטלפון הזה. התחברו לאינטרנט לרגע ונסו שוב
          </p>
        )}
        {pages && (
          <>
            <p className="flex items-center justify-center gap-1.5 px-4 pt-3 text-xs text-neutral-500">
              <SunMedium aria-hidden className="size-4" />
              הגבירו את בהירות המסך לסריקה · הקשה על העמוד מגדילה
            </p>
            {pages.map((data, index) => (
              <div key={index} className="px-3 pt-3">
                <img
                  src={`data:image/jpeg;base64,${data}`}
                  alt={pages.length > 1 ? `עמוד ${index + 1} מתוך ${pages.length}` : ticket.name}
                  onClick={() => setZoomed((current) => (current === index ? null : index))}
                  className={zoomed === index ? 'w-[200%] max-w-none' : 'mx-auto w-full max-w-xl'}
                />
                {pages.length > 1 && (
                  <p className="pt-1 text-center text-xs text-neutral-400">
                    {index + 1} / {pages.length}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </motion.div>
  )
}
