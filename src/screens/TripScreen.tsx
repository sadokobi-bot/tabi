import { CalendarCheck, Share2 } from 'lucide-react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { TripBoard } from '@/components/trip/TripBoard'
import { Button } from '@/components/ui/Button'
import { addDays, formatDay, tripTimeline } from '@/lib/dates'
import { useNow } from '@/hooks/useNow'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/** Trip manager: every day of the trip at a glance, with drag & drop planning. */
export default function TripScreen() {
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const places = useTripStore((state) => state.places)
  const placesById = useTripStore((state) => state.placesById)
  const now = useNow(60_000)
  const { phase, today } = tripTimeline(trip, now)

  const scheduledCount = Object.values(plan).reduce((sum, items) => sum + items.length, 0)
  const range = `${formatDay(trip.startDate, { day: 'numeric', month: 'short' })} – ${formatDay(addDays(trip.startDate, trip.days - 1), { day: 'numeric', month: 'short', year: 'numeric' })}`

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
          {trip.days} ימים · {places.length} מקומות שמורים · {scheduledCount} פעילויות בלו״ז
        </p>
        {phase === 'during' && (
          <Button variant="ghost" className="mt-2 -ms-2 text-accent" icon={<CalendarCheck aria-hidden className="size-4" />} onClick={jumpToToday}>
            קפיצה להיום
          </Button>
        )}
      </div>

      <div className="mt-5">
        <TripBoard trip={trip} plan={plan} places={places} placesById={placesById} today={today} />
      </div>
    </div>
  )
}
