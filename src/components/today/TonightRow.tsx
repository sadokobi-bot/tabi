import { Navigation } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Place } from '@/data/types'
import { directionsUrl } from '@/lib/deeplinks'
import { ui } from '@/store/ui'

/** Tonight's hotel, one tap away from directions back to it. */
export function TonightRow({ place }: { place: Place }) {
  return (
    <div className="surface flex items-center gap-3 rounded-card p-3">
      <button type="button" onClick={() => ui.openPlace(place.id)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <CategoryIcon category={place.category} className="size-11" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{place.name}</span>
          <span className="block text-xs text-muted">ישנים כאן הלילה</span>
        </span>
      </button>
      <a
        href={directionsUrl(place.location, { placeId: place.googlePlaceId })}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-control bg-accent/12 px-3 text-sm font-semibold text-accent transition active:scale-[0.97]"
      >
        <Navigation aria-hidden className="size-4 -scale-x-100" />
        חזרה למלון
      </a>
    </div>
  )
}
