import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Phone, X } from 'lucide-react'
import type { Place } from '@/data/types'
import { usePoiProvider } from '@/maps/usePoiProvider'

/** Live Japanese name and address from Google (session cache, never stored). */
function useLocalNames(googlePlaceId: string | undefined, enabled: boolean) {
  const provider = usePoiProvider()
  const [names, setNames] = useState<{ name?: string; address?: string } | null>(null)

  useEffect(() => {
    if (!enabled || !googlePlaceId || !provider?.localNames) return
    let cancelled = false
    provider.localNames(googlePlaceId).then(
      (result) => !cancelled && setNames(result),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [provider, googlePlaceId, enabled])

  return names
}

/**
 * Full-screen card to hand a taxi driver or a passer-by: the place in Japanese, in large print,
 * black on white whatever the theme. Uses the address typed for a hotel, else Google's Japanese one.
 */
export function DriverCard({ place, open, onClose }: { place: Place; open: boolean; onClose: () => void }) {
  const local = useLocalNames(place.googlePlaceId, open)
  const name = local?.name ?? place.name
  // A Hebrew name means nothing to a Japanese driver: then the address carries the card.
  const readable = !/[֐-׿]/.test(name)
  const address = place.hotel?.addressJa || local?.address || place.address
  const phone = place.hotel?.phone

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="כרטיס לנהג"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-white text-neutral-950"
        >
          <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <p className="text-sm text-neutral-500">הראו את המסך לנהג</p>
            <button
              type="button"
              aria-label="סגירה"
              onClick={onClose}
              autoFocus
              className="tap-target relative grid size-11 place-items-center rounded-full bg-neutral-100 text-neutral-700"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <div lang="ja" dir="ltr" className="flex flex-1 flex-col justify-center gap-8 px-7 pb-16 text-center">
            <p className="text-xl text-neutral-500">こちらまでお願いします</p>
            <p className={readable ? 'text-[2.6rem] leading-tight font-bold break-words' : 'text-lg text-neutral-500'}>{name}</p>
            {address && <p className="text-2xl leading-snug break-words">{address}</p>}
            {phone && (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                className="mx-auto flex items-center gap-2 text-2xl font-semibold tabular-nums"
              >
                <Phone aria-hidden className="size-6" />
                {phone}
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
