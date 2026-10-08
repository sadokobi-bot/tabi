import { LogOut, Navigation } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Place } from '@/data/types'
import { directionsUrl } from '@/lib/deeplinks'
import { ui } from '@/store/ui'

/** Tonight's hotel, one tap away from directions back to it. On arrival day: check-in time and booking number. */
export function TonightRow({ place, checkInToday }: { place: Place; checkInToday: boolean }) {
  const { checkIn, code } = place.hotel ?? {}
  const subtitle = checkInToday
    ? [`צ׳ק־אין היום${checkIn ? ` מ־${checkIn}` : ''}`, code && `הזמנה ${code}`].filter(Boolean).join(' · ')
    : 'ישנים כאן הלילה'

  return (
    <div className="surface flex items-center gap-3 rounded-card p-3">
      <button type="button" onClick={() => ui.openPlace(place.id)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <CategoryIcon category={place.category} className="size-11" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{place.name}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </button>
      <a
        href={directionsUrl(place.location, { placeId: place.googlePlaceId })}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-control bg-accent/12 px-3 text-sm font-semibold text-accent transition active:scale-[0.97]"
      >
        <Navigation aria-hidden className="size-4 -scale-x-100" />
        {checkInToday ? 'למלון' : 'חזרה למלון'}
      </a>
    </div>
  )
}

/** Moving on today: leave last night's hotel by its check-out time. */
export function CheckoutRow({ place }: { place: Place }) {
  const checkOut = place.hotel?.checkOut
  return (
    <button
      type="button"
      onClick={() => ui.openPlace(place.id)}
      className="flex w-full items-center gap-2.5 rounded-control bg-amber-400/12 px-4 py-2.5 text-start text-sm"
    >
      <LogOut aria-hidden className="size-4 shrink-0 -scale-x-100 text-amber-700 dark:text-amber-400" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">צ׳ק־אאוט היום{checkOut ? ` עד ${checkOut}` : ''}</span>
        <span className="text-muted"> · {place.name}</span>
      </span>
    </button>
  )
}
