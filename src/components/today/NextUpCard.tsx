import { ChevronLeft, Navigation, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
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
  if (at == null || nowMinutes == null) return time ?? null
  const diff = at - nowMinutes
  if (diff <= 0) return 'עכשיו'
  if (diff < 60) return `בעוד ${diff} דק׳`
  const hours = Math.floor(diff / 60)
  const minutes = diff % 60
  return minutes ? `בעוד ${hours} ש׳ ו-${minutes} דק׳` : `בעוד ${hours} ש׳`
}

/** The highlighted "what's next" card. */
export function NextUpCard({ item, place, nowMinutes, eyebrow }: NextUpCardProps) {
  const config = CATEGORIES[place.category]
  const Icon = config.icon
  const relative = relativeLabel(item.time, nowMinutes)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[1.75rem] bg-fg p-5 text-bg shadow-[0_22px_44px_-26px_rgb(0_0_0/0.6)]"
    >
      {/* the red sun of the flag, half set behind the card edge */}
      <span aria-hidden className="absolute -end-12 -top-14 size-40 rounded-full bg-accent/90" />

      <p className="relative flex items-center gap-1.5 text-xs font-semibold tracking-wide text-bg/70">
        <Sparkles aria-hidden className="size-3.5" />
        {eyebrow}
      </p>

      <button type="button" onClick={() => ui.openPlace(place.id)} className="relative mt-3 flex w-full items-center gap-3 text-start">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-bg/10">
          <Icon aria-hidden className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[1.4rem] leading-tight font-bold">{place.name}</span>
          <span className="mt-1 block text-sm text-bg/70">
            {item.time && (
              <span className="font-semibold tabular-nums" dir="ltr">
                {item.time}
              </span>
            )}
            {relative && relative !== item.time && <span> · {relative}</span>}
            {!item.time && config.label}
          </span>
        </span>
        <ChevronLeft aria-hidden className="size-5 shrink-0 text-bg/60" />
      </button>

      <a
        href={directionsUrl(place.location, { placeId: place.googlePlaceId })}
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-accent-fg transition active:scale-[0.97]"
      >
        <Navigation aria-hidden className="size-4 -scale-x-100" />
        קח אותי לשם
      </a>
    </motion.article>
  )
}
