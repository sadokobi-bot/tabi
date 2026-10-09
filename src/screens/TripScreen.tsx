import { useState } from 'react'
import clsx from 'clsx'
import { CalendarCheck, Share2, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { TripBoard } from '@/components/trip/TripBoard'
import { TripJournal } from '@/components/trip/TripJournal'
import { Button } from '@/components/ui/Button'
import { addDays, formatDay, tripTimeline } from '@/lib/dates'
import { useNow } from '@/hooks/useNow'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'
import { hasFirebase } from '@/config/env'

/** Trip manager: every day of the trip at a glance, with drag & drop planning. */
export default function TripScreen() {
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const places = useTripStore((state) => state.places)
  const placesById = useTripStore((state) => state.placesById)
  const now = useNow(60_000)
  const { phase, today } = tripTimeline(trip, now)
  const [view, setView] = useState<'plan' | 'journal'>('plan')

  const scheduledCount = Object.values(plan).reduce((sum, items) => sum + items.length, 0)
  const range = `${formatDay(trip.startDate, { day: 'numeric', month: 'short' })} - ${formatDay(addDays(trip.startDate, trip.days - 1), { day: 'numeric', month: 'short', year: 'numeric' })}`

  const jumpToToday = () => {
    document.getElementById(`day-${today}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="pt-screen mx-auto w-full max-w-md px-4">
      <div className="px-1">
        <ScreenHeader
          title={trip.name}
          subtitle={range}
          trailing={
            <Button variant="secondary" icon={<Share2 aria-hidden className="size-4" />} onClick={() => ui.setProfileOpen(true)}>
              שיתוף
            </Button>
          }
        />
        <p className="mt-0.5 text-sm text-muted">
          {trip.days} ימים, {places.length} מקומות שמורים ו-{scheduledCount} פעילויות בלו״ז
        </p>
        <div role="tablist" aria-label="תצוגה" className="mt-4 grid grid-cols-2 rounded-control bg-fg/6 p-1">
          {(
            [
              ['plan', 'תכנון'],
              ['journal', 'יומן'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={clsx(
                'relative h-9 rounded-inner text-sm font-semibold transition-colors',
                view === value ? 'text-fg' : 'text-muted',
              )}
            >
              {view === value && (
                <motion.span
                  layoutId="trip-view"
                  className="absolute inset-0 rounded-inner bg-card shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        {view === 'plan' && hasFirebase && (
          <button
            type="button"
            onClick={() => ui.setTripWizard(true)}
            className="mt-3 flex w-full items-center gap-3 rounded-control bg-accent/10 px-4 py-3 text-start transition active:scale-[0.98]"
          >
            <Sparkles aria-hidden className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-accent">בנו לנו את כל הטיול</span>
              <span className="block text-xs text-muted">שאלון קצר, וה-AI מתכנן כל יום. מה שכבר בלו״ז נשאר</span>
            </span>
          </button>
        )}
        {view === 'plan' && phase === 'during' && (
          <Button
            variant="ghost"
            className="mt-2 -ms-2 text-accent"
            icon={<CalendarCheck aria-hidden className="size-4" />}
            onClick={jumpToToday}
          >
            קפיצה להיום
          </Button>
        )}
      </div>

      <div className="mt-5">
        {view === 'plan' ? (
          <TripBoard trip={trip} plan={plan} places={places} placesById={placesById} today={today} />
        ) : (
          <TripJournal trip={trip} places={places} />
        )}
      </div>
    </div>
  )
}
