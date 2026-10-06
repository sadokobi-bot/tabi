import { ChevronLeft, Navigation } from 'lucide-react'
import { motion } from 'motion/react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { CATEGORIES } from '@/data/categories'
import type { ItineraryItem, Place } from '@/data/types'
import { directionsUrl } from '@/lib/deeplinks'
import { parseHm } from '@/lib/dates'
import { ui } from '@/store/ui'

interface NextUpCardProps {
  item: ItineraryItem
  place: Place
  /** Minutes since midnight in Japan, or null when the card previews a future day. */
  nowMinutes: number | null
  eyebrow: string
}

function relativeLabel(time: string | undefined, nowMinutes: number | null): string | null {
  const at = parseHm(time)
  if (at == null || nowMinutes == null) return null
  const diff = at - nowMinutes
  if (diff <= 0) return 'עכשיו'
  if (diff < 60) return `בעוד ${diff} דק׳`
  const hours = Math.floor(diff / 60)
  const minutes = diff % 60
  return minutes ? `בעוד ${hours}:${String(minutes).padStart(2, '0')} ש׳` : `בעוד ${hours} ש׳`
}

/** The highlighted "what's next" card, with one-tap navigation. */
export function NextUpCard({ item, place, nowMinutes, eyebrow }: NextUpCardProps) {
  const relative = relativeLabel(item.time, nowMinutes)

  return (
    <motion.article layout className="surface rounded-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-accent">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          {eyebrow}
        </p>
        {relative && <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">{relative}</span>}
      </div>

      <button type="button" onClick={() => ui.openPlace(place.id)} className="mt-3 flex w-full items-center gap-3 text-start">
        <CategoryIcon category={place.category} className="size-13" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.2rem] leading-tight font-bold">{place.name}</span>
          <span className="mt-1 block truncate text-sm text-muted">
            {item.time && (
              <span className="font-semibold text-fg tabular-nums" dir="ltr">
                {item.time}
              </span>
            )}
            {item.time && ' · '}
            {item.note || CATEGORIES[place.category].label}
          </span>
        </span>
        <ChevronLeft aria-hidden className="size-5 shrink-0 text-muted" />
      </button>

      <a
        href={directionsUrl(place.location, { placeId: place.googlePlaceId })}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex h-12 items-center justify-center gap-2 rounded-control bg-accent text-sm font-bold text-accent-fg shadow-[0_12px_24px_-14px_var(--app-accent)] transition active:scale-[0.97]"
      >
        <Navigation aria-hidden className="size-4 -scale-x-100" />
        קח אותי לשם
      </a>
    </motion.article>
  )
}
