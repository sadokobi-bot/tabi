import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { oniStill } from '@/components/brand/FrameLoop'
import clsx from 'clsx'
import { CalendarCheck, ChevronDown, ChevronRight, RefreshCw, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TextAreaField } from '@/components/ui/TextField'
import { CITIES, getCity } from '@/data/cities'
import { seasonFor, type SeasonEvent } from '@/lib/seasons'
import { CREATOR_DONE_MS, preloadCreatorFrames, TripCreatorCat } from './TripCreatorCat'
import { FAILURE_TEXT, failureOf, type AssistantFailure } from '@/lib/assistant'
import { formatDay, tripDates } from '@/lib/dates'
import { KOSHER_INFO, kosherNote } from '@/lib/mealOptions'
import {
  ATTRACTIONS,
  kosherStatus,
  planTrip,
  saveTripPlan,
  type PlanProgress,
  type TripPlan,
  type TripPreferences,
} from '@/lib/tripPlanner'
import { usePoiProvider } from '@/maps/usePoiProvider'
import { useTrip, useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'

const INTERESTS = [
  'מקדשים ותרבות',
  'אוכל רחוב',
  'מסעדות טובות',
  'טבע ונוף',
  'קניות',
  'מוזיאונים ואמנות',
  'בתי קפה',
  'חיי לילה',
  'אנימה וגיימינג',
  'אונסן ורוגע',
]
const FOOD = ['כשר', 'צמחוני', 'טבעוני', 'בלי חזיר', 'בלי פירות ים']

const DEFAULTS: TripPreferences = {
  travelers: 'friends',
  pace: 'balanced',
  budget: 'mid',
  cities: [],
  mustSee: '',
  interests: [],
  attractions: [],
  food: [],
  notes: '',
  season: [],
}

type Phase =
  | { name: 'questions'; page: 0 | 1 | 2 }
  | { name: 'planning'; progress: PlanProgress; finished?: boolean }
  | { name: 'preview'; plan: TripPlan }
  | { name: 'error'; failure: AssistantFailure }

/** "Plan the whole trip": a short questionnaire, then the AI builds every day; previewed before it's saved. */
export function TripWizard() {
  const open = useUi((state) => state.tripWizard)
  return createPortal(<AnimatePresence>{open && <Wizard />}</AnimatePresence>, document.body)
}

function Wizard() {
  const trip = useTrip()
  const provider = usePoiProvider()
  const hasPlan = useTripStore((state) => Object.values(state.plan).some((items) => items.length > 0))
  const [prefs, setPrefs] = useState<TripPreferences>(() => ({
    ...DEFAULTS,
    cities: [...new Set(Object.values(trip.dayCities).filter(Boolean) as string[])],
    // What's on during the trip is built in unless they say otherwise.
    season: seasonFor(trip.startDate, trip.days)
      .filter((event) => event.kind === 'highlight')
      .map((event) => event.id),
  }))
  const [phase, setPhase] = useState<Phase>({ name: 'questions', page: 0 })
  const running = useRef(false)
  // The animation's frames load while they answer the questions.
  useEffect(() => void preloadCreatorFrames(), [])
  const season = seasonFor(trip.startDate, trip.days)
  const set = (patch: Partial<TripPreferences>) => setPrefs((current) => ({ ...current, ...patch }))
  const close = () => ui.setTripWizard(false)

  // Not while it's working: closing would throw the plan away.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !running.current && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const start = async () => {
    running.current = true
    setPhase({ name: 'planning', progress: { done: 0, total: 1, label: 'מתחילים…' } })
    try {
      const plan = await planTrip(trip, prefs, provider, (progress) => setPhase({ name: 'planning', progress }))
      const planned = plan.days.filter((day) => day.stops.length > 0).length
      if (planned === 0) {
        setPhase({ name: 'error', failure: 'other' })
        return
      }
      // A moment to cheer before the plan shows.
      setPhase({ name: 'planning', progress: { done: 1, total: 1, label: 'הטיול מוכן! 🎒' }, finished: true })
      await new Promise((resolve) => setTimeout(resolve, CREATOR_DONE_MS))
      setPhase({ name: 'preview', plan })
    } catch (error) {
      console.error('[trip wizard] failed', error)
      setPhase({ name: 'error', failure: failureOf(error) })
    } finally {
      running.current = false
    }
  }

  const save = (plan: TripPlan) => {
    const added = saveTripPlan(trip, plan)
    ui.toast(`הלו״ז נשמר: ${added} פעילויות ב-${plan.days.filter((day) => day.stops.length).length} ימים`)
    close()
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="תכנון כל הטיול"
      className="fixed inset-0 z-[65] flex flex-col bg-bg"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.25 }}
    >
      <header className="flex shrink-0 items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        {phase.name === 'questions' && phase.page > 0 ? (
          <button
            type="button"
            aria-label="חזרה"
            onClick={() => setPhase({ name: 'questions', page: (phase.page - 1) as 0 | 1 })}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-fg/6"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        ) : (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
            <Sparkles className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight">תכנון כל הטיול</h1>
          <p className="truncate text-xs text-muted">
            {trip.name} · {trip.days} ימים
          </p>
        </div>
        {phase.name !== 'planning' && (
          <button
            type="button"
            aria-label="סגירה"
            onClick={close}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-fg/6"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="mx-auto max-w-md">
          {phase.name === 'questions' && (
            <Questions
              page={phase.page}
              prefs={prefs}
              set={set}
              hasPlan={hasPlan}
              season={season}
              onNext={() => (phase.page < 2 ? setPhase({ name: 'questions', page: (phase.page + 1) as 1 | 2 }) : void start())}
            />
          )}
          {phase.name === 'planning' && <Planning progress={phase.progress} days={trip.days} finished={phase.finished} />}
          {phase.name === 'preview' && <Preview plan={phase.plan} kosher={kosherStatus(phase.plan, prefs)} />}
          {phase.name === 'error' && (
            <div className="py-16 text-center">
              <p className="text-sm text-muted">{FAILURE_TEXT[phase.failure]}</p>
              <div className="mt-5 flex justify-center gap-2">
                <Button onClick={() => void start()}>לנסות שוב</Button>
                <Button variant="secondary" onClick={() => setPhase({ name: 'questions', page: 0 })}>
                  לשאלון
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {phase.name === 'preview' && (
        <div className="flex shrink-0 gap-2 border-t border-line bg-bg px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="mx-auto flex w-full max-w-md gap-2">
            <Button size="lg" className="flex-1" icon={<CalendarCheck aria-hidden className="size-4.5" />} onClick={() => save(phase.plan)}>
              שמירה ({phase.plan.days.filter((day) => day.stops.length).length} ימים)
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon={<RefreshCw aria-hidden className="size-4" />}
              onClick={() => setPhase({ name: 'questions', page: 0 })}
            >
              מחדש
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function Questions({
  page,
  prefs,
  set,
  hasPlan,
  season,
  onNext,
}: {
  page: 0 | 1 | 2
  prefs: TripPreferences
  set: (patch: Partial<TripPreferences>) => void
  hasPlan: boolean
  season: SeasonEvent[]
  onNext: () => void
}) {
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  return (
    <div>
      <div className="mt-1 flex gap-1.5" aria-label={`שלב ${page + 1} מתוך 3`}>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className={clsx('h-1 flex-1 rounded-full', dot <= page ? 'bg-accent-fill' : 'bg-fg/10')} />
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.18 }}
          className="mt-5 space-y-6"
        >
          {page === 0 && (
            <>
              <Intro image={oniStill('map')} title="כמה שאלות קצרות, ואנחנו נבנה לכם את כל הטיול">
                לו״ז מלא לכל יום, עם אטרקציות ומסעדות. אחר כך אפשר לשנות הכול.
                {hasPlan && ' פעילויות שכבר בלו״ז יישארו, והתכנון ייבנה סביבן.'}
              </Intro>
              {season.length > 0 && (
                <SeasonCard events={season} selected={prefs.season} onToggle={(id) => set({ season: toggle(prefs.season, id) })} />
              )}
              <Question title="מי נוסע?">
                <Choice
                  options={[
                    ['couple', 'זוג'],
                    ['friends', 'חברים'],
                    ['family', 'משפחה עם ילדים'],
                    ['solo', 'לבד'],
                  ]}
                  value={prefs.travelers}
                  onChange={(travelers) => set({ travelers })}
                />
              </Question>
              <Question title="באיזה קצב?">
                <Choice
                  options={[
                    ['relaxed', 'רגוע'],
                    ['balanced', 'מאוזן'],
                    ['packed', 'אינטנסיבי'],
                  ]}
                  value={prefs.pace}
                  onChange={(pace) => set({ pace })}
                />
              </Question>
              <Question title="תקציב">
                <Choice
                  options={[
                    ['budget', 'חסכוני'],
                    ['mid', 'בינוני'],
                    ['luxury', 'מפנק'],
                  ]}
                  value={prefs.budget}
                  onChange={(budget) => set({ budget })}
                />
              </Question>
            </>
          )}
          {page === 1 && (
            <>
              <Question title="לאילו ערים?" hint="לא בטוחים? אל תבחרו, ואנחנו נבנה מסלול בשבילכם">
                <Chips
                  options={CITIES.map((city) => [city.id, city.name])}
                  selected={prefs.cities}
                  onToggle={(id) => set({ cities: toggle(prefs.cities, id) })}
                />
              </Question>
              <TextAreaField
                label="מקומות שאתם חייבים לבקר בהם (לא חובה)"
                value={prefs.mustSee}
                onChange={(event) => set({ mustSee: event.target.value })}
                placeholder="למשל: מוזיאון ג׳יבלי, יוניברסל, הר פוג׳י, teamLab"
                maxLength={400}
                rows={3}
                dir={prefs.mustSee ? 'auto' : 'rtl'}
              />
            </>
          )}
          {page === 2 && (
            <>
              <Question title="מה אתם אוהבים?">
                <Chips
                  options={INTERESTS.map((i) => [i, i])}
                  selected={prefs.interests}
                  onToggle={(i) => set({ interests: toggle(prefs.interests, i) })}
                />
              </Question>
              <Question title="אטרקציות שבא לכם?" hint="נשבץ אותן בימים המתאימים (פארק שעשועים לוקח יום שלם)">
                <Chips
                  options={ATTRACTIONS.map((a) => [a.id, a.label])}
                  selected={prefs.attractions}
                  onToggle={(id) => set({ attractions: toggle(prefs.attractions, id) })}
                />
              </Question>
              <Question title="מגבלות באוכל?">
                <Chips options={FOOD.map((f) => [f, f])} selected={prefs.food} onToggle={(f) => set({ food: toggle(prefs.food, f) })} />
                {prefs.food.includes('כשר') && (
                  <p className="mt-2.5 rounded-control bg-amber-400/12 px-3.5 py-2.5 text-xs leading-relaxed">
                    {KOSHER_INFO} לשאר הארוחות נבחר מסעדות צמחוניות וטבעוניות.
                  </p>
                )}
              </Question>
              <TextAreaField
                label="עוד משהו? (לא חובה)"
                value={prefs.notes}
                onChange={(event) => set({ notes: event.target.value })}
                placeholder="אלרגיות, ימים שרוצים לנוח, חגיגה מיוחדת, מישהו שלא אוהב ללכת הרבה…"
                maxLength={400}
                rows={3}
                dir={prefs.notes ? 'auto' : 'rtl'}
              />
            </>
          )}
          <Button
            size="lg"
            className="w-full"
            icon={page === 2 ? <Sparkles aria-hidden className="size-4.5" /> : undefined}
            onClick={onNext}
          >
            {page === 2 ? 'בנו לנו את הטיול' : 'הבא'}
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** What's on in Japan during the trip: highlights to build in (on by default) and things worth knowing. */
function SeasonCard({ events, selected, onToggle }: { events: SeasonEvent[]; selected: string[]; onToggle: (id: string) => void }) {
  const highlights = events.filter((event) => event.kind === 'highlight')
  const headsUps = events.filter((event) => event.kind === 'heads-up')
  return (
    <section aria-label="העונה שלכם" className="surface rounded-card p-4">
      <p className="text-sm font-semibold">מה קורה ביפן בתאריכים שלכם</p>
      {highlights.length > 0 && (
        <ul className="mt-3 space-y-2">
          {highlights.map((event) => {
            const on = selected.includes(event.id)
            return (
              <li key={event.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => onToggle(event.id)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-control p-3 text-start transition',
                    on ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-fg/[0.04]',
                  )}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {event.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{event.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{event.note}</span>
                  </span>
                  <span
                    className={clsx(
                      'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      on ? 'bg-accent-fill text-accent-fg' : 'bg-fg/8 text-muted',
                    )}
                  >
                    {on ? 'נשלב בטיול' : 'לא לשלב'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {headsUps.length > 0 && (
        <ul className="mt-3 space-y-2">
          {headsUps.map((event) => (
            <li key={event.id} className="flex gap-3 rounded-control bg-amber-400/10 p-3 text-xs leading-relaxed">
              <span aria-hidden className="text-lg leading-none">
                {event.emoji}
              </span>
              <span>
                <b className="text-sm font-semibold">{event.title}</b>
                <span className="block text-muted">{event.note}. נתכנן בהתאם.</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Intro({ image, title, children }: { image: string; title: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <img src={image} alt="" aria-hidden className="size-24 shrink-0 object-contain" />
      <div>
        <p className="font-semibold leading-snug">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  )
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

function Choice<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (value: T) => void }) {
  return (
    <div
      role="radiogroup"
      className="grid gap-1 rounded-control bg-fg/6 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={clsx(
            'min-h-10 rounded-inner px-1 text-sm font-semibold transition',
            value === id ? 'bg-accent-fill text-accent-fg shadow-sm' : 'text-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Chips({ options, selected, onToggle }: { options: [string, string][]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([id, label]) => {
        const on = selected.includes(id)
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(id)}
            className={clsx(
              'h-9 rounded-full px-3.5 text-sm font-medium transition-colors',
              on ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg hover:bg-fg/10',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Planning({ progress, days, finished }: { progress: PlanProgress; days: number; finished?: boolean }) {
  const share = Math.max(0.04, Math.min(1, progress.done / progress.total))
  return (
    <div className="flex flex-col items-center pt-4 pb-12 text-center">
      <TripCreatorCat />
      <p role="status" className={clsx('mt-6 font-semibold', finished && 'text-lg text-accent')}>
        {progress.label}
      </p>
      {!finished && (
        <>
          <div className="mt-4 h-2 w-full max-w-64 overflow-hidden rounded-full bg-fg/8">
            <motion.div
              className="h-full rounded-full bg-accent-fill"
              animate={{ width: `${share * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted">
            בונים לכם {days} ימים. {days > 10 ? 'בטיול ארוך זה לוקח כמה דקות' : 'זה לוקח כדקה'}, השאירו את המסך פתוח.
          </p>
        </>
      )}
    </div>
  )
}

function Preview({ plan, kosher }: { plan: TripPlan; kosher: 'found' | 'none' | null }) {
  const trip = useTrip()
  const dates = tripDates(trip)
  const [open, setOpen] = useState<string | null>(plan.days[0]?.date ?? null)
  return (
    <div className="mt-2">
      {plan.reply && <p className="rounded-control bg-accent/[0.07] px-4 py-3 text-sm leading-relaxed">{plan.reply}</p>}
      {kosher && (
        <p
          className={clsx(
            'mt-2 rounded-control px-4 py-2.5 text-sm font-medium',
            kosher === 'found'
              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-400/12 text-amber-900 dark:text-amber-300',
          )}
        >
          {kosher === 'found' ? kosherNote('בית חב״ד') : kosherNote()}
        </p>
      )}
      {plan.failed.length > 0 && (
        <p className="mt-2 rounded-control bg-fg/5 px-4 py-2.5 text-xs leading-relaxed text-muted">
          {plan.failed.length === 1 ? 'יום אחד לא תוכנן' : `${plan.failed.length} ימים לא תוכננו`}. אפשר לתכנן אותם אחר כך עם ״תכננו לי את
          היום״.
        </p>
      )}

      <ol className="mt-4 space-y-2">
        {plan.days.map((day) => {
          const expanded = open === day.date
          return (
            <li key={day.date} className="surface overflow-hidden rounded-control">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : day.date)}
                className="flex w-full items-center gap-3 p-3 text-start"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-inner bg-accent/12 text-sm font-bold text-accent tabular-nums">
                  {dates.indexOf(day.date) + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{day.theme || getCity(day.city)?.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {getCity(day.city)?.name} · {formatDay(day.date, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                    {day.stops.length ? `${day.stops.length} עצירות` : 'לא תוכנן'}
                  </span>
                </span>
                <ChevronDown aria-hidden className={clsx('size-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded && day.stops.length > 0 && (
                <ul className="space-y-2 border-t border-line px-3 py-3">
                  {day.stops.map((stop, index) => (
                    <li key={index} className="flex items-start gap-2.5">
                      <span className="w-11 shrink-0 pt-1.5 text-end text-xs font-semibold tabular-nums" dir="ltr">
                        {stop.time}
                      </span>
                      <CategoryIcon
                        category={stop.poi?.category && stop.poi.category !== 'other' ? stop.poi.category : stop.category}
                        className="size-7"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{stop.name}</span>
                        {stop.why && <span className="block text-xs leading-relaxed text-muted">{stop.why}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
