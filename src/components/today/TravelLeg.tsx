import clsx from 'clsx'
import { ChevronLeft, Footprints, TrainFront, TriangleAlert } from 'lucide-react'
import type { ItineraryItem, Place } from '@/data/types'
import { parseHm } from '@/lib/dates'
import { directionsUrl } from '@/lib/deeplinks'
import { estimateLeg } from '@/lib/travel'

/** Closer than this the two stops are the same spot (e.g. lunch inside the museum). */
const SAME_SPOT_M = 60

const hm = (minutes: number) => {
  const wrapped = (minutes + 24 * 60) % (24 * 60)
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

export const durationLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} דק׳` : minutes % 60 === 0 ? `${minutes / 60} ש׳` : `${Math.floor(minutes / 60)} ש׳ ${minutes % 60} דק׳`

interface TravelLegProps {
  from: { item: ItineraryItem; place: Place }
  to: { item: ItineraryItem; place: Place }
}

/**
 * The trip between two stops on the timeline: an estimate (walk or train), when to leave for a
 * timed stop, and a warning when the gap is shorter than the ride. Taps open the real connection
 * in Google Maps, which has Japan's train timetables.
 */
export function TravelLeg({ from, to }: TravelLegProps) {
  const leg = estimateLeg(from.place.location, to.place.location)
  if (leg.meters < SAME_SPOT_M) return null

  const arriveBy = parseHm(to.item.time)
  const departAt = parseHm(from.item.time)
  const tooTight = arriveBy != null && departAt != null && arriveBy - departAt < leg.minutes
  const Icon = leg.mode === 'walk' ? Footprints : TrainFront
  const how = leg.mode === 'walk' ? 'הליכה' : leg.mode === 'intercity' ? 'ברכבת מהירה' : 'ברכבת'
  const href = directionsUrl(to.place.location, {
    origin: from.place.location,
    mode: leg.mode === 'walk' ? 'walking' : 'transit',
    ...(to.place.googlePlaceId ? { placeId: to.place.googlePlaceId } : {}),
  })

  return (
    <li className="relative flex items-center gap-3">
      <span aria-hidden className="w-11 shrink-0" />
      <span aria-hidden className="size-3 shrink-0" />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-1.5 rounded-inner py-1 text-xs transition active:opacity-60',
          tooTight ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted',
        )}
      >
        {tooTight ? <TriangleAlert aria-hidden className="size-3.5 shrink-0" /> : <Icon aria-hidden className="size-3.5 shrink-0" />}
        <span className="truncate">
          ≈ {durationLabel(leg.minutes)} {how}
          {tooTight
            ? ` · רק ${durationLabel(arriveBy - departAt)} בין הפעילויות`
            : arriveBy != null && ` · לצאת עד ${hm(arriveBy - leg.minutes)}`}
        </span>
        <ChevronLeft aria-hidden className="size-3.5 shrink-0 opacity-60" />
      </a>
    </li>
  )
}
