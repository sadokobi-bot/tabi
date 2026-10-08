import clsx from 'clsx'
import { BookmarkCheck, Check, ChevronLeft, MapPinned, Navigation } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { CATEGORIES } from '@/data/categories'
import { meetInstant, openSharedPlace, untilLabel, voteIn } from '@/data/chat'
import type { ChatMessage, MeetPoint, Poll, SharedPlace, Trip } from '@/data/types'
import { formatDay, isoDateInTz } from '@/lib/dates'
import { directionsUrl } from '@/lib/deeplinks'
import { useNow } from '@/hooks/useNow'
import { useTripStore } from '@/store/trip'

/** A place someone shared: opens it, with save / schedule / directions from there. */
export function PlaceCard({ place, messageId }: { place: SharedPlace; messageId: string }) {
  const saved = useTripStore((state) => (place.placeId ? state.placesById[place.placeId] : undefined))
  return (
    <button
      type="button"
      onClick={() => openSharedPlace(place, messageId)}
      className="flex w-full items-center gap-3 rounded-control bg-fg/[0.04] p-2.5 text-start transition active:scale-[0.98]"
    >
      <CategoryIcon category={place.category} className="size-11" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold" dir="auto">
          {place.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          {saved ? (
            <>
              <BookmarkCheck aria-hidden className="size-3.5 shrink-0 text-accent" /> שמור בטיול
            </>
          ) : (
            (place.address ?? CATEGORIES[place.category].label)
          )}
        </span>
      </span>
      <ChevronLeft aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  )
}

export function meetWhen(meet: MeetPoint, now: number): string {
  const today = isoDateInTz(new Date(now))
  const day = meet.date === today ? 'היום' : formatDay(meet.date, { weekday: 'long', day: 'numeric', month: 'short' })
  return `${day} ב-${meet.time}`
}

/** "Meet at … at …", with how long until then and one-tap directions. */
export function MeetCard({ meet, compact }: { meet: MeetPoint; compact?: boolean }) {
  const now = useNow(30_000).getTime()
  const at = meetInstant(meet)
  return (
    <div className={clsx('flex items-center gap-3', compact ? '' : 'rounded-control bg-fg/[0.04] p-2.5')}>
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-control bg-emerald-500/14 text-emerald-600 dark:text-emerald-400"
      >
        <MapPinned className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[15px] leading-snug font-semibold">
          נקודת מפגש: <bdi>{meet.name}</bdi>
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          {meetWhen(meet, now)}
          {at > now - 30 * 60_000 && <span className="font-semibold text-emerald-700 dark:text-emerald-400"> · {untilLabel(at, now)}</span>}
        </span>
      </span>
      <a
        href={directionsUrl(meet.location, { mode: 'walking' })}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`ניווט אל ${meet.name}`}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/14 text-emerald-700 transition active:scale-90 dark:text-emerald-400"
      >
        <Navigation aria-hidden className="size-4.5 -scale-x-100" />
      </a>
    </div>
  )
}

/** A poll: tap an answer to vote (again to take it back); live counts and who chose what. */
export function PollCard({ message, poll, uid, trip }: { message: ChatMessage; poll: Poll; uid: string; trip: Trip }) {
  const votes = message.votes ?? {}
  const total = Object.keys(votes).length
  const mine = votes[uid]
  const top = Math.max(0, ...poll.options.map((_, index) => Object.values(votes).filter((vote) => vote === index).length))

  return (
    <div>
      <p className="text-[15px] leading-snug font-semibold" dir="auto">
        {poll.question}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {poll.options.map((option, index) => {
          const voters = Object.entries(votes).flatMap(([voter, vote]) => (vote === index ? [voter] : []))
          const share = total ? voters.length / total : 0
          const chosen = mine === index
          return (
            <li key={index}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => voteIn(message, chosen ? null : index)}
                className={clsx(
                  'relative w-full overflow-hidden rounded-inner border px-3 py-2 text-start transition active:scale-[0.98]',
                  chosen ? 'border-accent' : 'border-line',
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    'absolute inset-y-0 start-0 transition-[width] duration-300',
                    voters.length && voters.length === top ? 'bg-accent/16' : 'bg-fg/6',
                  )}
                  style={{ width: `${share * 100}%` }}
                />
                <span className="relative flex items-center gap-2">
                  <span
                    className={clsx(
                      'grid size-5 shrink-0 place-items-center rounded-full border-2',
                      chosen ? 'border-accent bg-accent-fill text-accent-fg' : 'border-line',
                    )}
                  >
                    {chosen && <Check aria-hidden className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    <bdi>{option.label}</bdi>
                  </span>
                  <span className="text-xs font-semibold text-muted tabular-nums">{voters.length || ''}</span>
                </span>
                {voters.length > 0 && (
                  <span className="relative mt-0.5 block truncate ps-7 text-[11px] text-muted">
                    {voters.map((voter) => (trip.members[voter]?.name ?? '').split(' ')[0]).join(', ')}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        {total === 0 ? 'עוד אין הצבעות' : total === 1 ? 'הצבעה אחת' : `${total} הצבעות`}
        {total < trip.memberIds.length && total > 0 && ` מתוך ${trip.memberIds.length}`}
      </p>
    </div>
  )
}
