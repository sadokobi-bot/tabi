import { useEffect, useState, type ReactNode } from 'react'
import {
  BookmarkCheck,
  BookmarkPlus,
  CalendarPlus,
  Clock,
  ExternalLink,
  Globe,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { CategoryBadge } from '@/components/ui/CategoryIcon'
import { Button } from '@/components/ui/Button'
import { actions } from '@/data/actions'
import { sharedPlaceOf } from '@/data/chat'
import type { CategoryId, LatLng, Place } from '@/data/types'
import { formatDay, tripDates } from '@/lib/dates'
import { placeUrl, safeHttpUrl } from '@/lib/deeplinks'
import { checkOpening, closedLabel } from '@/lib/openingHours'
import type { Poi, PoiProvider } from '@/maps/poi'
import { usePlaceDetails } from '@/maps/usePlaceDetails'
import { usePoiProvider } from '@/maps/usePoiProvider'
import { scheduleOf, useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'
import { BookingSection } from './BookingSection'
import { HotelSection } from './HotelSection'
import { NavigateBar } from './NavigateBar'
import { VisitSection } from './VisitSection'
import { PlaceHero } from './PlaceHero'
import { TicketSection } from './TicketSection'

export interface PlaceSubject {
  name: string
  category: CategoryId
  location: LatLng
  address?: string
  googlePlaceId?: string
  osmId?: string
  saved?: Place
  poi?: Poi
}

interface PlaceViewProps {
  subject: PlaceSubject
  onEdit: () => void
  onSchedule: (placeId: string) => void
}

/** Google matching is attempted at most once per place per session (it's a billed call). */
const linkAttempts = new Set<string>()

function useAutoLinkGoogle(provider: PoiProvider | null, place: Place | undefined) {
  useEffect(() => {
    if (!provider?.matchGoogle || !place || place.googlePlaceId || linkAttempts.has(place.id)) return
    linkAttempts.add(place.id)
    provider.matchGoogle(place.name, place.location).then(
      (googlePlaceId) => {
        if (googlePlaceId) actions.updatePlace(place, { googlePlaceId })
      },
      () => undefined,
    )
  }, [provider, place])
}

export function PlaceView({ subject, onEdit, onSchedule }: PlaceViewProps) {
  const provider = usePoiProvider()
  const details = usePlaceDetails(provider, subject.googlePlaceId)
  const navigate = useNavigate()
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showHours, setShowHours] = useState(false)

  const saved = subject.saved
  useAutoLinkGoogle(provider, saved)

  const data = details.data
  const name = subject.name || data?.name || 'מקום על המפה'
  const category = subject.category !== 'other' ? subject.category : (data?.category ?? 'other')
  const address = data?.address ?? subject.address
  const extras = subject.poi?.extras
  const website = safeHttpUrl(data?.website ?? extras?.website)
  const phone = data?.phone ?? extras?.phone
  const dates = tripDates(trip)
  const schedule = saved ? scheduleOf(plan, saved.id) : []

  // Today's line first (Google lists Monday → Sunday).
  const todayIndex = (new Date().getDay() + 6) % 7
  const hours = data?.weekdayHours
  const todayHours = hours?.[todayIndex]

  const saveFromView = (): Place =>
    actions.createPlace({
      name,
      category,
      location: subject.location,
      ...(address ? { address } : {}),
      ...(subject.googlePlaceId ? { googlePlaceId: subject.googlePlaceId } : {}),
      ...(subject.osmId ? { osmId: subject.osmId } : {}),
    })

  const showOnMap = () => {
    navigate('/map')
    ui.moveCamera({ center: subject.location, zoom: 16 })
  }

  const googleLink = data?.googleMapsUri ?? placeUrl({ name, location: subject.location, googlePlaceId: subject.googlePlaceId })

  return (
    <div>
      <PlaceHero category={category} photos={data?.photos ?? []} loading={details.status === 'loading'} onClose={ui.closeSheet} />

      <div className="px-5 pt-4">
        <h2 className="text-[1.375rem] leading-snug font-bold tracking-tight">{name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CategoryBadge category={category} />
          {saved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">
              <BookmarkCheck aria-hidden className="size-3.5" /> שמור בטיול
            </span>
          )}
          {data?.rating != null && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <Star aria-hidden className="size-4 fill-amber-400 text-amber-400" />
              {data.rating.toFixed(1)}
              {data.ratingCount != null && <span className="font-normal text-muted">({data.ratingCount.toLocaleString('he-IL')})</span>}
            </span>
          )}
          {data?.typeLabel && <span className="text-xs text-muted">{data.typeLabel}</span>}
        </div>

        <div className="mt-4 space-y-2.5">
          {address && <InfoRow icon={MapPin}>{address}</InfoRow>}
          {extras?.cuisine && <InfoRow icon={UtensilsCrossed}>{extras.cuisine}</InfoRow>}
          {todayHours && (
            <InfoRow icon={Clock}>
              <button type="button" onClick={() => setShowHours((v) => !v)} className="text-start">
                {todayHours}
                <span className="ms-1 text-xs text-accent">{showHours ? 'פחות' : 'כל השבוע'}</span>
              </button>
              {showHours && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                  {hours?.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </InfoRow>
          )}
          {!todayHours && extras?.openingHours && <InfoRow icon={Clock}>{extras.openingHours}</InfoRow>}
          {website && (
            <InfoRow icon={Globe}>
              <a href={website} target="_blank" rel="noopener noreferrer" className="break-all text-accent">
                {new URL(website).hostname}
              </a>
            </InfoRow>
          )}
          {phone && (
            <InfoRow icon={Phone}>
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-accent" dir="ltr">
                {phone}
              </a>
            </InfoRow>
          )}
        </div>

        {saved?.notes && (
          <p className="mt-4 rounded-control bg-amber-400/12 px-4 py-3 text-sm leading-relaxed whitespace-pre-line">{saved.notes}</p>
        )}
        {saved?.url && safeHttpUrl(saved.url) && (
          <a
            href={safeHttpUrl(saved.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
          >
            <ExternalLink aria-hidden className="size-4" /> קישור שמרתם
          </a>
        )}

        {saved && (saved.category === 'hotel' || Object.values(trip.stays).includes(saved.id)) && (
          <HotelSection key={`hotel-${saved.id}`} place={saved} />
        )}
        {saved && <VisitSection key={`visit-${saved.id}`} place={saved} />}
        {saved && !saved.visit && <BookingSection key={saved.id} place={saved} />}
        {saved && saved.category !== 'hotel' && <TicketSection key={`tickets-${saved.id}`} place={saved} />}

        {schedule.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted">משובץ בלו״ז</p>
            <div className="flex flex-wrap gap-2">
              {schedule.map(({ date, item }) => (
                <span key={item.id} className="surface inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-1 text-xs font-medium">
                  יום {dates.indexOf(date) + 1} · {formatDay(date)}
                  {item.time && <span className="text-muted tabular-nums">· {item.time}</span>}
                  <button
                    type="button"
                    aria-label="הסרה מהיום"
                    onClick={() => actions.removeFromDay(date, item.id)}
                    className="tap-target relative grid size-6 place-items-center rounded-full text-muted hover:bg-fg/8 hover:text-fg"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            {schedule.map(({ date, item }) => {
              const label = closedLabel(checkOpening(data?.openingPeriods, date, item.time))
              return (
                label && (
                  <p key={item.id} className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    יום {dates.indexOf(date) + 1}: {label}
                  </p>
                )
              )
            })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-4 gap-2">
          {saved ? (
            <ActionButton icon={CalendarPlus} label="שבץ ביום" onClick={() => onSchedule(saved.id)} />
          ) : (
            <ActionButton icon={BookmarkPlus} label="שמירה" accent onClick={() => ui.openPlace(saveFromView().id)} />
          )}
          {saved ? (
            <ActionButton icon={Pencil} label="עריכה" onClick={onEdit} />
          ) : (
            <ActionButton icon={CalendarPlus} label="שמור ושבץ" onClick={() => onSchedule(saveFromView().id)} />
          )}
          <ActionButton icon={MapIcon} label="במפה" onClick={showOnMap} />
          <ActionButton icon={ExternalLink} label="Google Maps" href={googleLink} />
        </div>
        <button
          type="button"
          onClick={() => {
            ui.setChatDraft(
              sharedPlaceOf({
                name,
                category,
                location: subject.location,
                ...(address ? { address } : {}),
                ...(saved ? { id: saved.id } : {}),
                ...(subject.googlePlaceId ? { googlePlaceId: subject.googlePlaceId } : {}),
                ...(subject.osmId ? { osmId: subject.osmId } : {}),
              }),
            )
            navigate('/chat')
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-control bg-fg/5 py-3 text-sm font-semibold transition hover:bg-fg/8 active:scale-[0.98]"
        >
          <MessageCircle aria-hidden className="size-4.5" />
          שיתוף בצ׳אט של הטיול
        </button>

        {saved && (
          <div className="mt-4 flex items-center justify-center">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">למחוק את המקום מהטיול?</span>
                <Button
                  variant="danger"
                  onClick={() => {
                    actions.deletePlace(saved.id)
                    ui.closeSheet()
                  }}
                >
                  מחיקה
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  ביטול
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-inner px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <Trash2 aria-hidden className="size-4" /> מחיקת המקום
              </button>
            )}
          </div>
        )}

        {provider?.id === 'google' && subject.googlePlaceId && (
          <p className="mt-3 text-center text-[10px] text-muted">מידע ותמונות: Google</p>
        )}
      </div>

      <NavigateBar destination={subject.location} placeId={subject.googlePlaceId} />
    </div>
  )
}

function InfoRow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm leading-relaxed">
      <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  href?: string
  accent?: boolean
}

function ActionButton({ icon: Icon, label, onClick, href, accent }: ActionButtonProps) {
  const className =
    'flex flex-col items-center justify-center gap-1.5 rounded-control py-3 text-xs font-semibold transition active:scale-95 ' +
    (accent ? 'bg-accent/12 text-accent' : 'bg-fg/5 text-fg hover:bg-fg/8')
  const content = (
    <>
      <Icon aria-hidden className="size-5" />
      {label}
    </>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}
