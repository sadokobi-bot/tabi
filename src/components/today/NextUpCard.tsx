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
      className="relative overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[0_24px_48px_-24px_var(--app-accent)]"
      style={{ background: 'linear-gradient(140deg, #f0704f 0%, #e2553a 45%, #b8342a 100%)' }}
    >
      {/* soft sun disc, a nod to the Japanese flag */}
      <span aria-hidden className="absolute -end-10 -top-12 size-44 rounded-full bg-white/12" />

      <p className="relative flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/85">
        <Sparkles aria-hidden className="size-3.5" />
        {eyebrow}
      </p>

      <button type="button" onClick={() => ui.openPlace(place.id)} className="relative mt-3 flex w-full items-center gap-3 text-start">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/18 backdrop-blur">
          <Icon aria-hidden className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xl leading-tight font-bold">{place.name}</span>
          <span className="mt-1 block text-sm text-white/85">
            {item.time && (
              <span className="font-semibold tabular-nums" dir="ltr">
                {item.time}
              </span>
            )}
            {relative && relative !== item.time && <span> · {relative}</span>}
            {!item.time && config.label}
          </span>
        </span>
        <ChevronLeft aria-hidden className="size-5 shrink-0 text-white/70" />
      </button>

      <a
        href={directionsUrl(place.location, { placeId: place.googlePlaceId })}
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-[#c2402c] transition active:scale-[0.97]"
      >
        <Navigation aria-hidden className="size-4 -scale-x-100" />
        קח אותי לשם
      </a>
    </motion.article>
  )
}
