import { QrCode } from 'lucide-react'
import { TicketRow } from '@/components/place/TicketSection'
import type { ItineraryItem, Place } from '@/data/types'
import { useTripStore } from '@/store/trip'

export const TICKETS_TODAY_ID = 'tickets-today'

/** The entry tickets for today's stops, one tap from the Today screen. */
export function TicketsTodayCard({ items, placesById }: { items: ItineraryItem[]; placesById: Record<string, Place> }) {
  const tickets = useTripStore((state) => state.tickets)
  const order = items.map((item) => item.placeId)
  const today = tickets
    .filter((ticket) => order.includes(ticket.placeId))
    .sort((a, b) => order.indexOf(a.placeId) - order.indexOf(b.placeId))
  if (today.length === 0) return null

  return (
    <section id={TICKETS_TODAY_ID} className="surface scroll-mt-4 rounded-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <QrCode aria-hidden className="size-4.5 text-accent" />
        {today.length > 1 ? `${today.length} כרטיסים להיום` : 'הכרטיס של היום'}
      </h2>
      <ul className="space-y-2">
        {today.map((ticket) => (
          <li key={ticket.id}>
            <TicketRow ticket={ticket} showPlace={placesById[ticket.placeId]?.name ?? ticket.name} />
          </li>
        ))}
      </ul>
    </section>
  )
}
