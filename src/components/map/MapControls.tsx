import clsx from 'clsx'
import { Compass, LocateFixed, LocateOff, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { GeoStatus } from '@/hooks/useGeolocation'

interface MapControlsProps {
  bearing: number
  geoStatus: GeoStatus
  following: boolean
  onLocate: () => void
  onResetNorth: () => void
  onAdd: () => void
}

/** Floating action buttons above the tab bar (inline-end side). */
export function MapControls({ bearing, geoStatus, following, onLocate, onResetNorth, onAdd }: MapControlsProps) {
  const rotated = Math.abs(bearing) > 1

  return (
    <div className="bottom-above-tabbar absolute end-4 z-10 flex flex-col items-center gap-3">
      <AnimatePresence>
        {rotated && (
          <motion.button
            key="compass"
            type="button"
            aria-label="איפוס כיוון המפה לצפון"
            onClick={onResetNorth}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="glass grid size-11 place-items-center rounded-full"
          >
            <Compass aria-hidden className="size-5 text-accent" style={{ transform: `rotate(${-bearing - 45}deg)` }} />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="המיקום שלי"
        whileTap={{ scale: 0.9 }}
        onClick={onLocate}
        className={clsx('glass grid size-12 place-items-center rounded-full', following && 'text-location')}
      >
        {geoStatus === 'denied' || geoStatus === 'unavailable' ? (
          <LocateOff aria-hidden className="size-5 text-muted" />
        ) : (
          <LocateFixed aria-hidden className={clsx('size-5', geoStatus === 'locating' && 'animate-pulse')} />
        )}
      </motion.button>

      <motion.button
        type="button"
        aria-label="הוספת מקום משלנו"
        whileTap={{ scale: 0.9 }}
        onClick={onAdd}
        className="grid size-14 place-items-center rounded-full bg-accent-fill text-accent-fg shadow-accent"
      >
        <Plus aria-hidden className="size-7" strokeWidth={2.4} />
      </motion.button>
    </div>
  )
}
