import { Moon, Phone } from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import { TRIP_TZ, minutesInTz } from '@/lib/dates'

const HOME_TZ = 'Asia/Jerusalem'

const timeIn = (timeZone: string) => new Intl.DateTimeFormat('he-IL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const japanTime = timeIn(TRIP_TZ)
const homeTime = timeIn(HOME_TZ)

/** Japan time next to home time, with a hint whether it's a decent hour to call home. */
export function ClockStrip() {
  const now = useNow(20_000)
  const homeMinutes = minutesInTz(now, HOME_TZ)
  const diffHours = Math.round((((minutesInTz(now, TRIP_TZ) - homeMinutes) / 60 + 36) % 24) - 12)
  const homeAwake = homeMinutes >= 8 * 60 && homeMinutes < 22 * 60

  return (
    <div className="surface rounded-3xl text-sm">
      <div className="flex items-stretch">
        <Clock label="ביפן" kanji="日本" time={japanTime.format(now)} />
        <div className="my-3 w-px bg-line" />
        <Clock label="בבית" time={homeTime.format(now)} />
      </div>
      <p className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
        {homeAwake ? (
          <Phone aria-hidden className="size-3.5 shrink-0 text-matcha" />
        ) : (
          <Moon aria-hidden className="size-3.5 shrink-0 text-ai" />
        )}
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-fg">{homeAwake ? 'שעה טובה להתקשר הביתה' : 'בבית ישנים עכשיו'}</span>
          {' · '}יפן מקדימה ב-{diffHours} שעות
        </span>
      </p>
    </div>
  )
}

function Clock({ label, time, kanji }: { label: string; time: string; kanji?: string }) {
  return (
    <div className="flex-1 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {label}
        {kanji && (
          <span lang="ja" className="font-jp text-[0.7rem] font-semibold">
            {kanji}
          </span>
        )}
      </p>
      <p className="mt-0.5 font-display text-[1.45rem] leading-none font-bold tabular-nums" dir="ltr">
        {time}
      </p>
    </div>
  )
}
