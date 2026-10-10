import { useState } from 'react'
import clsx from 'clsx'
import {
  Bus,
  ChevronDown,
  ChevronLeft,
  Footprints,
  Lightbulb,
  Navigation,
  Ship,
  Sparkles,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { create } from 'zustand'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { hasFirebase } from '@/config/env'
import { nearestCity } from '@/data/cities'
import { TRANSIT_GUIDE } from '@/data/transitGuide'
import type { Place } from '@/data/types'
import { explainRouteWithAi, FAILURE_TEXT, failureOf, type AssistantFailure, type RouteExplanation, type RouteMode } from '@/lib/assistant'
import { directionsUrl } from '@/lib/deeplinks'
import { estimateLeg } from '@/lib/travel'
import { durationLabel } from './TravelLeg'

const useTransit = create<{ guide: boolean; leg: { from: Place; to: Place } | null }>(() => ({ guide: false, leg: null }))

/** "How to get around Japan". */
export const openTransitGuide = () => useTransit.setState({ guide: true, leg: null })
/** One ride on the day's timeline: how to get from one stop to the next. */
export const openRoute = (from: Place, to: Place) => useTransit.setState({ leg: { from, to } })

/** Both transit sheets; mounted once in the app layout. */
export function TransitSheets() {
  const guide = useTransit((state) => state.guide)
  const leg = useTransit((state) => state.leg)
  return (
    <>
      <BottomSheet open={guide} onClose={() => useTransit.setState({ guide: false })} label="איך מתניידים ביפן">
        <TransitGuide />
      </BottomSheet>
      <BottomSheet open={!!leg} onClose={() => useTransit.setState({ leg: null })} label="איך מגיעים">
        {leg && <RouteDetails key={`${leg.from.id}>${leg.to.id}`} from={leg.from} to={leg.to} />}
      </BottomSheet>
    </>
  )
}

/** The guide's entry on the Today screen. */
export function TransitGuideRow() {
  return (
    <button
      type="button"
      onClick={openTransitGuide}
      className="surface flex w-full items-center gap-3 rounded-card p-4 text-start transition active:scale-[0.98]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
        <TrainFront aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">איך מתניידים ביפן</span>
        <span className="block truncate text-sm text-muted">כרטיס Suica, רכבות, שינקנסן ונימוסים</span>
      </span>
      <ChevronLeft aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  )
}

function TransitGuide() {
  const [open, setOpen] = useState<string | null>(TRANSIT_GUIDE[0]!.id)
  return (
    <div className="px-5 pt-1 pb-5">
      <h2 className="text-xl font-bold tracking-tight">איך מתניידים ביפן</h2>
      <p className="mt-1 text-sm text-muted">הרכבות ביפן מדויקות, נקיות ובטוחות. כמה דברים שכדאי לדעת לפני:</p>
      <div className="mt-4 space-y-2">
        {TRANSIT_GUIDE.map(({ id, title, icon: Icon, points }) => {
          const expanded = open === id
          return (
            <section key={id} className="surface overflow-hidden rounded-card">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-start"
              >
                <Icon aria-hidden className="size-5 shrink-0 text-accent" />
                <span className="flex-1 font-semibold">{title}</span>
                <ChevronDown aria-hidden className={clsx('size-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <ul className="space-y-2 border-t border-line px-4 py-3 text-sm leading-relaxed">
                  {points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/60" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

const MODE_ICON: Record<RouteMode, LucideIcon> = {
  walk: Footprints,
  train: TrainFront,
  subway: TrainFrontTunnel,
  bus: Bus,
  shinkansen: Zap,
  tram: TramFront,
  ferry: Ship,
}

type Phase =
  { name: 'idle' } | { name: 'loading' } | { name: 'done'; route: RouteExplanation } | { name: 'error'; failure: AssistantFailure }

function RouteDetails({ from, to }: { from: Place; to: Place }) {
  const leg = estimateLeg(from.location, to.location)
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const href = directionsUrl(to.location, {
    origin: from.location,
    mode: leg.mode === 'walk' ? 'walking' : 'transit',
    ...(to.googlePlaceId ? { placeId: to.googlePlaceId } : {}),
  })

  const explain = () => {
    setPhase({ name: 'loading' })
    explainRouteWithAi({ from, to, city: nearestCity(from.location)?.en }).then(
      (route) => setPhase({ name: 'done', route }),
      (error: unknown) => setPhase({ name: 'error', failure: failureOf(error) }),
    )
  }
  return (
    <div className="px-5 pt-1 pb-5">
      <p className="text-sm text-muted">איך מגיעים</p>
      <h2 className="mt-0.5 text-lg leading-snug font-bold">
        <bdi>{from.name}</bdi> ← <bdi>{to.name}</bdi>
      </h2>
      <p className="mt-1 text-sm text-muted">
        בערך {durationLabel(leg.minutes)} {leg.mode === 'walk' ? 'הליכה' : leg.mode === 'intercity' ? 'ברכבת מהירה' : 'ברכבת'}
      </p>

      {hasFirebase && phase.name === 'idle' && (
        <Button className="mt-4 w-full" icon={<Sparkles aria-hidden className="size-4" />} onClick={explain}>
          הסבר צעד אחר צעד
        </Button>
      )}
      {phase.name === 'loading' && (
        <div className="mt-4 space-y-2" aria-busy>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-10 animate-pulse rounded-control bg-fg/6" />
          ))}
        </div>
      )}
      {phase.name === 'error' && (
        <div className="mt-4 rounded-control bg-fg/5 px-4 py-3 text-sm">
          <p className="text-muted">{FAILURE_TEXT[phase.failure]}</p>
          {phase.failure !== 'limit' && phase.failure !== 'disabled' && (
            <button type="button" onClick={explain} className="mt-2 font-semibold text-accent">
              לנסות שוב
            </button>
          )}
        </div>
      )}
      {phase.name === 'done' && (
        <div className="mt-4">
          <ol className="space-y-2">
            {phase.route.steps.map((step, index) => {
              const Icon = MODE_ICON[step.mode]
              return (
                <li key={index} className="flex items-start gap-3 rounded-control bg-fg/4 px-3 py-2.5 text-sm leading-relaxed">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="pt-0.5">{step.text}</span>
                </li>
              )
            })}
          </ol>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {phase.route.minutes > 0 && <span>⏱️ בערך {durationLabel(phase.route.minutes)}</span>}
            {phase.route.fareYen > 0 && <span>💴 בערך ¥{phase.route.fareYen.toLocaleString('en-US')} לאדם</span>}
          </p>
          {phase.route.tip && (
            <p className="mt-3 flex gap-2 rounded-control bg-amber-400/12 px-3.5 py-2.5 text-sm leading-relaxed">
              <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {phase.route.tip}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            {phase.route.sure ? 'ההסבר נכתב בעזרת AI. ' : 'ה-AI לא בטוח בקו המדויק. '}
            את הזמנים, הרציף והיציאה המדויקים בודקים ב-Google Maps.
          </p>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-control bg-fg/6 text-sm font-semibold transition active:scale-[0.98]"
        >
          <Navigation aria-hidden className="size-4" />
          המסלול ב-Google Maps
        </a>
        <button
          type="button"
          onClick={openTransitGuide}
          className="flex h-12 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-accent transition hover:bg-accent/8"
        >
          <TrainFront aria-hidden className="size-4" />
          המדריך
        </button>
      </div>
    </div>
  )
}
