import { Navigation } from 'lucide-react'
import { motion } from 'motion/react'
import { ClosedNote } from '@/components/place/ClosedNote'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { CATEGORIES } from '@/data/categories'
import type { ItineraryItem, Place } from '@/data/types'
import { directionsUrl } from '@/lib/deeplinks'
import { parseHm } from '@/lib/dates'
import { ui } from '@/store/ui'

interface NextUpCardProps {
  /** The day the item is on (YYYY-MM-DD). */
  date: string
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

/** The highlighted "what's next": one compact row, with one-tap navigation. */
export function NextUpCard({ date, item, place, nowMinutes, eyebrow }: NextUpCardProps) {
  const relative = relativeLabel(item.time, nowMinutes)

  return (
    <motion.article layout className="surface flex items-center gap-3 rounded-card p-3">
      <button type="button" onClick={() => ui.openPlace(place.id)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <CategoryIcon category={place.category} className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-fill opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent-fill" />
            </span>
            {eyebrow}
            {relative && <span className="font-medium text-muted">· {relative}</span>}
          </span>
          <span className="block truncate leading-tight font-bold">{place.name}</span>
          <span className="block truncate text-xs text-muted">
            {item.time && (
              <span className="font-semibold text-fg tabular-nums" dir="ltr">
                {item.time}
              </span>
            )}
            {item.time && ' · '}
            {CATEGORIES[place.category].label}
          </span>
          <ClosedNote place={place} date={date} time={item.time} fetch nowMinutes={nowMinutes} className="mt-0.5" />
        </span>
      </button>
      <a
        href={directionsUrl(place.location, { placeId: place.googlePlaceId })}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`ניווט אל ${place.name}`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-fill text-accent-fg shadow-accent transition active:scale-90"
      >
        <Navigation aria-hidden className="size-[18px] -scale-x-100" />
      </a>
    </motion.article>
  )
}
