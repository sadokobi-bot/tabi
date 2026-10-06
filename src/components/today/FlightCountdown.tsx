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
  const departure = new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(next.departAt))

  return (
    <div className="surface flex items-center gap-3 rounded-card p-3 pe-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
        <Plane aria-hidden className="size-5 -scale-x-100" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {next.label}
          {(next.from || next.to) && (
            <span dir="ltr" className="mx-1.5 inline-block text-xs font-medium text-muted">
              {next.from} → {next.to}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          {next.flightNo ? `${next.flightNo} · ` : ''}
          {departure}
        </p>
      </div>
      <p className="shrink-0 text-end leading-none font-bold tabular-nums" dir="ltr" aria-live="off">
        {days > 0 && (
          <span className="block text-xl" dir="rtl">
            {days}
            <span className="ms-0.5 text-xs font-semibold text-muted">{days === 1 ? 'יום' : 'ימים'}</span>
          </span>
        )}
        <span className={days > 0 ? 'mt-1 block text-xs font-semibold text-muted' : 'text-xl'}>
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </p>
    </div>
  )
}
