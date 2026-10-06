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

  return (
    <div
      className="flex min-h-32 flex-col justify-between rounded-3xl p-4 text-white shadow-[0_18px_40px_-18px_#2f4f9a]"
      style={{ background: 'linear-gradient(135deg, #2b4a8b 0%, #3e5c9a 55%, #6a5fb0 100%)' }}
    >
      <p className="flex items-center justify-between text-xs font-medium text-white/80">
        <span className="truncate">{next.label}</span>
        <span dir="ltr" className="font-semibold">
          {next.from} → {next.to}
        </span>
      </p>
      <p className="mt-1 leading-none font-bold tabular-nums" dir="ltr" aria-live="off">
        {days > 0 && (
          <span className="text-[1.6rem]">
            {days}
            <span className="ms-0.5 text-sm font-semibold text-white/80">d</span>{' '}
          </span>
        )}
        <span className={days > 0 ? 'text-base' : 'text-[1.6rem]'}>
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-white/80">
        <Plane aria-hidden className="size-3.5 shrink-0 -scale-x-100" />
        {next.flightNo ? `${next.flightNo} · ` : ''}
        {departure}
      </p>
    </div>
  )
}
