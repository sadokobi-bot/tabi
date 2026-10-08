import { ChevronLeft, CircleCheck, Luggage } from 'lucide-react'
import { luggageSent, type HotelMove } from '@/data/luggage'

/**
 * Moving hotels: the evening before, a nudge to send the suitcases ahead; on the day, still possible
 * (they arrive a day later); once sent, where they are.
 */
export function LuggageRow({ move, when, onOpen }: { move: HotelMove; when: 'tonight' | 'today'; onOpen: () => void }) {
  const sent = luggageSent(move)
  const title = sent
    ? `המזוודות בדרך אל ${move.to.name}`
    : when === 'tonight'
      ? 'שולחים את המזוודות הערב?'
      : `עוד אפשר לשלוח מזוודות אל ${move.to.name}`
  const subtitle = sent
    ? move.to.luggage?.tracking
      ? `מספר מעקב ${move.to.luggage.tracking}`
      : 'מחכות בקבלה כשמגיעים'
    : when === 'tonight'
      ? `מחר עוברים אל ${move.to.name}`
      : 'בצ׳ק־אאוט, והן יגיעו מחר'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        sent
          ? 'flex w-full items-center gap-3 rounded-control bg-emerald-500/10 px-4 py-3 text-start'
          : 'surface flex w-full items-center gap-3 rounded-card p-3 text-start'
      }
    >
      {sent ? (
        <CircleCheck aria-hidden className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
          <Luggage className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted" dir="auto">
          {subtitle}
        </span>
      </span>
      <ChevronLeft aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  )
}
