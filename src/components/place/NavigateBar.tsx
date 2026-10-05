import { useState } from 'react'
import clsx from 'clsx'
import { Car, Footprints, Navigation, TrainFront } from 'lucide-react'
import type { LatLng } from '@/data/types'
import { directionsUrl, type TravelMode } from '@/lib/deeplinks'
import { haptic } from '@/lib/haptics'

const MODES: { id: TravelMode; label: string; icon: typeof TrainFront }[] = [
  { id: 'transit', label: 'תחבורה ציבורית', icon: TrainFront },
  { id: 'walking', label: 'הליכה', icon: Footprints },
  { id: 'driving', label: 'נסיעה', icon: Car },
]

const STORAGE_KEY = 'tabi:travelMode'

function readMode(): TravelMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'transit' || stored === 'walking' || stored === 'driving') return stored
  } catch {
    // ignore
  }
  return 'transit'
}

/**
 * Sticky "take me there" bar. The button is a real link to the Google Maps directions URL,
 * which phones hand to the native Google Maps app (deep link) with the destination prefilled.
 */
export function NavigateBar({ destination, placeId }: { destination: LatLng; placeId?: string }) {
  const [mode, setMode] = useState<TravelMode>(readMode)

  const choose = (next: TravelMode) => {
    setMode(next)
    haptic()
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-3 border-t border-line bg-[var(--glass-bg)] px-5 pt-3 pb-1 backdrop-blur-xl">
      <div role="radiogroup" aria-label="אמצעי תחבורה" className="flex shrink-0 rounded-2xl bg-fg/6 p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            aria-label={label}
            title={label}
            onClick={() => choose(id)}
            className={clsx(
              'grid size-9 place-items-center rounded-xl transition',
              mode === id ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            <Icon aria-hidden className="size-[18px]" />
          </button>
        ))}
      </div>
      <a
        href={directionsUrl(destination, { placeId, mode })}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => haptic(12)}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-accent-fg shadow-[0_12px_28px_-10px_var(--app-accent)] transition active:scale-[0.97]"
      >
        <Navigation aria-hidden className="size-5 -scale-x-100" />
        קח אותי לשם
      </a>
    </div>
  )
}
