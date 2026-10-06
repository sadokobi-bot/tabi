import clsx from 'clsx'
import type { City } from '@/data/cities'
import type { Trip } from '@/data/types'
import { formatDay, type TripTimeline } from '@/lib/dates'

interface DayHeroProps {
  trip: Trip
  timeline: TripTimeline
  city: City | undefined
}

/**
 * The page header of the day, like a stamp in a travel journal: a hanko with the day number
 * (or the countdown before the trip), where we are, and the whole trip as a row of days.
 */
export function DayHero({ trip, timeline, city }: DayHeroProps) {
  const { phase, dayNumber, daysUntil } = timeline

  const stamp =
    phase === 'before'
      ? { top: 'あと', number: daysUntil, bottom: '日' }
      : phase === 'during'
        ? { top: '第', number: dayNumber, bottom: '日目' }
        : { top: '', number: trip.days, bottom: '旅' }

  const title =
    phase === 'before'
      ? daysUntil === 1
        ? 'מחר טסים'
        : `עוד ${daysUntil} ימים לטיול`
      : phase === 'during'
        ? `יום ${dayNumber} מתוך ${trip.days}`
        : `${trip.days} ימים, ומה לא היה בהם`

  const subtitle =
    phase === 'before'
      ? `יוצאים ב${formatDay(trip.startDate, { weekday: 'long', day: 'numeric', month: 'long' })}`
      : phase === 'during'
        ? city
          ? null
          : 'עוד לא בחרנו עיר להיום'
        : 'הטיול הסתיים'

  const filled = phase === 'before' ? 0 : phase === 'during' ? dayNumber : trip.days

  return (
    <div className="surface relative overflow-hidden rounded-[1.75rem] p-4 pe-5">
      {/* Big faint kanji of the city, like a watermark printed on the page */}
      {city && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -start-3 font-jp text-[6.5rem] leading-none font-extrabold text-fg/[0.045] select-none"
        >
          {city.kanji}
        </span>
      )}

      <div className="relative flex items-center gap-4">
        <Hanko top={stamp.top} number={stamp.number} bottom={stamp.bottom} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1.45rem] leading-tight font-bold">{title}</p>
          {city && phase !== 'after' ? (
            <p className="mt-1 flex items-baseline gap-2 text-sm text-muted">
              <span className="font-semibold text-fg">{city.name}</span>
              <span className="font-jp text-[0.95rem] font-semibold tracking-widest" lang="ja">
                {city.kanji}
              </span>
            </p>
          ) : (
            subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>
          )}
        </div>
      </div>

      {/* The whole trip, one tick per day */}
      <div className="relative mt-4 flex gap-[3px]" aria-hidden dir="rtl">
        {Array.from({ length: trip.days }, (_, index) => (
          <span
            key={index}
            className={clsx(
              'h-1.5 flex-1 rounded-full',
              index < filled - 1 ? 'bg-accent/45' : index === filled - 1 ? 'bg-accent' : 'bg-fg/10',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/** A vermilion name seal, slightly crooked as if pressed by hand. */
function Hanko({ top, number, bottom }: { top: string; number: number; bottom: string }) {
  return (
    <div
      className="grid size-[4.6rem] shrink-0 -rotate-[4deg] place-items-center rounded-[1.1rem] bg-accent p-[3px] text-accent-fg shadow-[0_6px_16px_-8px_var(--app-accent)]"
      lang="ja"
    >
      <div className="flex size-full flex-col items-center justify-center rounded-[0.85rem] border-[1.5px] border-accent-fg/70 leading-none">
        {top && <span className="font-jp text-[0.7rem] font-semibold">{top}</span>}
        <span className={clsx('font-display font-black tabular-nums', number > 99 ? 'text-xl' : 'text-[1.75rem]')}>{number}</span>
        <span className="font-jp text-[0.7rem] font-semibold">{bottom}</span>
      </div>
    </div>
  )
}
