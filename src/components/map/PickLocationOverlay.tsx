import { MapPin } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'

/** "Move the map under the pin" mode for adding a custom place. */
export function PickLocationOverlay({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
        <motion.div initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="-translate-y-5">
          <MapPin className="size-11 fill-accent text-white drop-shadow-lg" strokeWidth={1.6} />
        </motion.div>
        <span className="absolute size-2 rounded-full bg-accent shadow" />
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass bottom-above-tabbar absolute inset-x-4 z-20 rounded-card p-4"
      >
        <p className="font-semibold">הזיזו את המפה כך שהסיכה תהיה על המקום</p>
        <p className="mt-0.5 text-sm text-muted">טיפ: אפשר גם ללחוץ לחיצה ארוכה על המפה.</p>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={onConfirm}>
            המקום כאן
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </motion.div>
    </>
  )
}
