import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Clock } from 'lucide-react'
import type { Place } from '@/data/types'
import { checkOpening, closedLabel } from '@/lib/openingHours'
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
  className?: string
}

/** A small warning when the place is closed on that day or at that time; nothing otherwise. */
export function ClosedNote({ place, date, time, fetch = false, className }: ClosedNoteProps) {
  const periods = useOpeningPeriods(place.googlePlaceId, fetch)
  const label = closedLabel(checkOpening(periods, date, time))
  if (!label) return null
  return (
    <span className={clsx('flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400', className)}>
      <Clock aria-hidden className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
