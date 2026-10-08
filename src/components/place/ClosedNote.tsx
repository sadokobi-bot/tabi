import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Clock } from 'lucide-react'
import type { Place } from '@/data/types'
import { parseHm } from '@/lib/dates'
import { checkOpening, closedLabel, closingLabel, closingStatus } from '@/lib/openingHours'
import type { PoiDetails } from '@/maps/poi'
import { usePoiProvider } from '@/maps/usePoiProvider'

/**
 * Google's opening hours for a saved place, this session only. With `fetch` off it only uses hours
 * already loaded (e.g. on the trip board, where fetching every row would burn the free quota).
 */
function useOpeningPeriods(googlePlaceId: string | undefined, fetch: boolean) {
  const provider = usePoiProvider()
  const [details, setDetails] = useState<PoiDetails | null | undefined>(() =>
    googlePlaceId ? provider?.peekDetails?.(googlePlaceId) : undefined,
  )

  useEffect(() => {
    if (!provider || provider.id !== 'google' || !googlePlaceId) {
      setDetails(undefined)
      return
    }
    const cached = provider.peekDetails?.(googlePlaceId)
    if (cached !== undefined || !fetch) {
      setDetails(cached)
      return
    }
    let cancelled = false
    provider.details(googlePlaceId).then(
      (data) => !cancelled && setDetails(data),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [provider, googlePlaceId, fetch])

  return details?.openingPeriods
}

interface ClosedNoteProps {
  place: Place
  date: string
  time?: string
  fetch?: boolean
  /** Minutes since midnight in Japan when `date` is today: also warns when it closes soon or already has. */
  nowMinutes?: number | null
  className?: string
}

/** A small warning when the place is closed on that day or at that time; nothing otherwise. */
export function ClosedNote({ place, date, time, fetch = false, nowMinutes = null, className }: ClosedNoteProps) {
  const periods = useOpeningPeriods(place.googlePlaceId, fetch)
  // Right now beats the plan: "closes in 20 min" matters more than the planned time. A stop with a
  // later time only needs the scheduled-time check ("opens later" would be noise).
  const live = nowMinutes == null ? null : closingLabel(closingStatus(periods, date, nowMinutes))
  const timedLater = time != null && nowMinutes != null && (parseHm(time) ?? 0) > nowMinutes + 30
  const now = live && !(timedLater && !live.urgent) ? live : null
  const label = now?.text ?? closedLabel(checkOpening(periods, date, time))
  if (!label) return null
  return (
    <span
      className={clsx(
        'flex items-center gap-1 text-xs font-medium',
        now?.urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      <Clock aria-hidden className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
