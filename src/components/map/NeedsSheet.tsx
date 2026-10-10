import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CircleCheck, ChevronRight, Footprints, Lightbulb, LoaderCircle } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import type { LatLng } from '@/data/types'
import { agodaUrl, bookingComUrl, directionsUrl } from '@/lib/deeplinks'
import { distanceMeters, formatDistance } from '@/lib/geo'
import { haptic } from '@/lib/haptics'
import {
  HOTEL_BUDGETS,
  NEED_BY_ID,
  NEEDS,
  takesForeignCards,
  walkMinutes,
  type HotelBudget,
  type NeedConfig,
  type NeedId,
} from '@/maps/needs'
import type { Poi, PoiProvider } from '@/maps/poi'

export interface NeedResult {
  need: NeedId
  pois: Poi[]
}

interface NeedsSheetProps {
  open: boolean
  onClose: () => void
  provider: PoiProvider | null
  /** Where to search from: the user's position, else the middle of the map. */
  origin: LatLng | null
  fromGps: boolean
  /** The need to show right away (reopening from the map), or null for the menu. */
  initialNeed: NeedId | null
  onResult: (result: NeedResult | null) => void
  onPick: (poi: Poi) => void
}

type Status = 'idle' | 'loading' | 'ok' | 'error'

const BUDGET_KEY = 'tabi.hotelBudget'

function readBudget(): HotelBudget {
  try {
    const saved = localStorage.getItem(BUDGET_KEY)
    if (saved === 'budget' || saved === 'mid' || saved === 'luxury') return saved
  } catch {
    // Storage blocked: use the default.
  }
  return 'mid'
}

/**
 * "I need … now": one tap finds the closest toilets, ATMs, convenience stores, lockers or
 * pharmacies, with the walk to each and one-tap walking directions.
 */
export function NeedsSheet({ open, onClose, provider, origin, fromGps, initialNeed, onResult, onPick }: NeedsSheetProps) {
  const [need, setNeed] = useState<NeedId | null>(initialNeed)
  const [status, setStatus] = useState<Status>('idle')
  const [pois, setPois] = useState<Poi[]>([])
  const [attempt, setAttempt] = useState(0)
  const [budget, setBudgetState] = useState<HotelBudget>(readBudget)
  const setBudget = (next: HotelBudget) => {
    setBudgetState(next)
    try {
      localStorage.setItem(BUDGET_KEY, next)
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  }

  useEffect(() => {
    if (open) setNeed(initialNeed)
  }, [open, initialNeed])

  // Searched once per need and origin; the results stay on the map after the sheet closes.
  const originKey = origin ? `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}` : ''
  useEffect(() => {
    if (!open || !need || !provider || !origin) return
    const controller = new AbortController()
    setStatus('loading')
    provider.nearby(need, origin, controller.signal, budget).then(
      (found) => {
        setPois(found)
        setStatus('ok')
        onResult({ need, pois: found })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        console.warn('[needs] search failed', error)
        setStatus('error')
      },
    )
    return () => controller.abort()
    // onResult is a fresh closure on every render of the map; the search depends on what's asked only.
  }, [open, need, provider, originKey, attempt, budget])

  const config = need ? NEED_BY_ID[need] : null

  return (
    <BottomSheet open={open} onClose={onClose} label="צריך עכשיו">
      <div className="px-5 pb-4">
        {!config ? (
          <>
            <h2 className="text-xl font-bold tracking-tight">צריך עכשיו</h2>
            <p className="mt-1 text-sm text-muted">{fromGps ? 'הכי קרוב אליכם' : 'הכי קרוב למרכז המפה'}, בלחיצה אחת</p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {NEEDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    haptic()
                    setNeed(item.id)
                  }}
                  className="surface flex flex-col items-center gap-2 rounded-control px-1 pt-4 pb-3.5 text-sm font-semibold transition active:scale-95"
                >
                  <NeedIcon need={item} className="size-12" />
                  {item.label}
                </button>
              ))}
            </div>
            {!origin && <p className="mt-4 text-center text-sm text-muted">מחכים למיקום…</p>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="חזרה לכל האפשרויות"
                onClick={() => {
                  setNeed(null)
                  setStatus('idle')
                  onResult(null)
                }}
                className="tap-target relative -ms-2 grid size-9 place-items-center rounded-full hover:bg-fg/8"
              >
                <ChevronRight aria-hidden className="size-5" />
              </button>
              <NeedIcon need={config} className="size-9" />
              <h2 className="text-xl font-bold tracking-tight">
                {config.plural} {fromGps ? 'בסביבה' : 'ליד מרכז המפה'}
              </h2>
            </div>
            <p className="mt-3 flex gap-2 rounded-control bg-amber-400/12 px-3.5 py-2.5 text-xs leading-relaxed">
              <Lightbulb aria-hidden className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {config.tip}
            </p>

            {need === 'hotel' && (
              <div role="group" aria-label="תקציב" className="mt-3 flex gap-2">
                {(Object.keys(HOTEL_BUDGETS) as HotelBudget[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={budget === key}
                    onClick={() => setBudget(key)}
                    className={clsx(
                      'flex-1 rounded-full px-3 py-2 text-sm font-semibold transition active:scale-95',
                      budget === key ? 'bg-accent text-white' : 'surface',
                    )}
                  >
                    {HOTEL_BUDGETS[key].label}
                  </button>
                ))}
              </div>
            )}

            {status === 'loading' && (
              <div className="grid place-items-center py-10">
                <LoaderCircle aria-label="מחפשים" className="size-6 animate-spin text-muted" />
              </div>
            )}
            {status === 'error' && (
              <div className="py-8 text-center text-sm">
                <p className="text-muted">לא הצלחנו לחפש כרגע</p>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-2 font-semibold text-accent">
                  לנסות שוב
                </button>
              </div>
            )}
            {status === 'ok' && pois.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                {need === 'hotel' ? 'לא מצאנו מלונות מומלצים באזור. נסו להזיז את המפה' : `לא מצאנו ${config.plural} בהליכה של עד רבע שעה`}
              </p>
            )}
            {status === 'ok' && pois.length > 0 && origin && (
              <ul className="mt-3 space-y-2">
                {pois.map((poi) => {
                  const meters = distanceMeters(origin, poi.location)
                  const foreign = need === 'atm' && takesForeignCards(poi.name)
                  return (
                    <li key={poi.key} className="surface flex items-center gap-1 rounded-control">
                      <button
                        type="button"
                        onClick={() => onPick(poi)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 ps-3.5 text-start"
                      >
                        <NeedIcon need={config} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold" dir="auto">
                            {poi.name}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            {need === 'hotel' ? (
                              <span>
                                {poi.rating ? `★ ${poi.rating.toFixed(1)} (${poi.ratingCount?.toLocaleString('he-IL')}) · ` : ''}
                                {formatDistance(meters)} מהמרכז
                              </span>
                            ) : (
                              <span>
                                {formatDistance(meters)} · {walkMinutes(meters)} דק׳ הליכה
                              </span>
                            )}
                            {foreign && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <CircleCheck aria-hidden className="size-3.5" />
                                כרטיס זר
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      {need === 'hotel' ? (
                        <span className="me-2 flex shrink-0 flex-col gap-1">
                          {[
                            ['Booking', bookingComUrl(poi.name)],
                            ['Agoda', agodaUrl(poi.name)],
                          ].map(([label, href]) => (
                            <a
                              key={label}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`הזמנת ${poi.name} ב-${label}`}
                              className="rounded-full bg-accent/12 px-3 py-1 text-center text-xs font-semibold text-accent transition active:scale-95"
                            >
                              {label}
                            </a>
                          ))}
                        </span>
                      ) : (
                        <a
                          href={directionsUrl(poi.location, { placeId: poi.googlePlaceId, mode: 'walking' })}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`הליכה אל ${poi.name}`}
                          className={clsx(
                            'me-2 flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-3 py-2 text-xs font-semibold text-accent',
                            'transition active:scale-95',
                          )}
                        >
                          <Footprints aria-hidden className="size-4" />
                          ניווט
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}

/** The need's icon on a soft tint of its color, like the category icons across the app. */
export function NeedIcon({ need, className }: { need: NeedConfig; className?: string }) {
  const Icon = need.icon
  return (
    <span
      aria-hidden
      className={clsx('inline-grid shrink-0 place-items-center rounded-control', className ?? 'size-10')}
      style={{ background: `color-mix(in oklab, ${need.color} 14%, transparent)`, color: need.color }}
    >
      <Icon className="size-[52%]" strokeWidth={2.2} />
    </span>
  )
}
