import { Plane } from 'lucide-react'
import type { Flight } from '@/data/types'
import { useNow } from '@/hooks/useNow'

const pad = (n: number) => String(n).padStart(2, '0')

/** Live countdown to the next upcoming flight (flights are added in the trip settings); nothing without one. */
export function FlightCountdown({ flights }: { flights: Flight[] }) {
  const now = useNow(1000)
  const next = [...flights]
    .filter((flight) => new Date(flight.departAt).getTime() > now.getTime())
    .sort((a, b) => a.departAt.localeCompare(b.departAt))[0]

  if (!next) return null

  const totalSeconds = Math.max(0, Math.floor((new Date(next.departAt).getTime() - now.getTime()) / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const departure = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(next.departAt),
  )

  // A paper boarding pass: route on the main part, the countdown on the tear-off stub.
  return (
    <div className="surface relative overflow-hidden rounded-3xl" dir="ltr">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-ai" />
      <div className="flex items-end justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">From</p>
          <p className="font-display text-[2rem] leading-none font-black">{next.from || '—'}</p>
        </div>
        <div className="mb-2 flex min-w-0 flex-1 items-center gap-2 text-ai">
          <span className="h-px flex-1 border-t border-dashed border-current opacity-50" />
          <Plane aria-hidden className="size-5 shrink-0 rotate-45" />
          <span className="h-px flex-1 border-t border-dashed border-current opacity-50" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">To</p>
          <p className="font-display text-[2rem] leading-none font-black">{next.to || '—'}</p>
        </div>
      </div>

      {/* tear line with punched notches */}
      <div className="relative h-3">
        <span aria-hidden className="absolute -left-2 top-0 size-3 rounded-full bg-bg" />
        <span aria-hidden className="absolute -right-2 top-0 size-3 rounded-full bg-bg" />
        <span aria-hidden className="absolute inset-x-4 top-1/2 border-t-2 border-dotted border-line" />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-4" dir="rtl">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{next.label}</p>
          <p className="truncate text-xs text-muted">
            {next.flightNo ? `${next.flightNo} · ` : ''}
            {departure}
          </p>
        </div>
        <p className="shrink-0 font-display leading-none font-bold tabular-nums text-ai" dir="ltr" aria-live="off">
          {days > 0 && (
            <span className="text-[1.6rem]">
              {days}
              <span className="ms-0.5 text-sm font-semibold opacity-75">d</span>{' '}
            </span>
          )}
          <span className={days > 0 ? 'text-base' : 'text-[1.6rem]'}>
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
          </span>
        </p>
      </div>
    </div>
  )
}
