import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { BellPlus, ExternalLink, Lightbulb, LoaderCircle, RefreshCw, Ticket } from 'lucide-react'
import { hasFirebase } from '@/config/env'
import { actions } from '@/data/actions'
import type { EntryInfo, Place } from '@/data/types'
import { entryInfoWithAi } from '@/lib/assistant'
import { readCachedRate } from '@/lib/currency'
import { safeHttpUrl } from '@/lib/deeplinks'
import { useTripStore } from '@/store/trip'

/** Asked once per session for places that aren't saved (saved ones keep the answer). */
const sessionCache = new Map<string, Promise<EntryInfo>>()

/** Big, well-known booking sites for Japan attractions; their search pages were checked to work. */
const BOOKING_SITES = [
  { name: 'Klook', url: (query: string) => `https://www.klook.com/search/result/?query=${encodeURIComponent(query)}` },
  { name: 'KKday', url: (query: string) => `https://www.kkday.com/en/product/productlist?keyword=${encodeURIComponent(query)}` },
]

const yen = (value: number) => `¥${value.toLocaleString('en-US')}`

interface EntryTicketsProps {
  name: string
  saved?: Place
  /** The official site, from Google (verified), when there is one. */
  website?: string
  typeLabel?: string
  address?: string
}

/**
 * Tickets for an attraction: free or paid, about how much (also in shekels), whether to book ahead,
 * a money-saving tip, and where to buy: the official site (Google's link) and the big booking sites.
 * The facts come from the AI and say so; links never do.
 */
export function EntryTickets({ name, saved, website, typeLabel, address }: EntryTicketsProps) {
  const [info, setInfo] = useState<EntryInfo | null>(saved?.entry ?? null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const load = (fresh = false) => {
    const key = saved?.id ?? name
    let pending = fresh ? undefined : sessionCache.get(key)
    if (!pending) {
      pending = entryInfoWithAi({ name, area: address, type: typeLabel, website })
      pending.catch(() => sessionCache.delete(key))
      sessionCache.set(key, pending)
    }
    setStatus('loading')
    pending.then(
      (result) => {
        setInfo(result)
        setStatus('idle')
        // Saved places keep the answer, for everyone in the trip.
        const latest = saved ? useTripStore.getState().placesById[saved.id] : undefined
        if (latest) actions.updatePlace(latest, { entry: result })
      },
      () => setStatus('error'),
    )
  }

  // A saved attraction is looked up once, by itself; for a map place it's a tap away.
  useEffect(() => {
    if (saved && !saved.entry && hasFirebase) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id])

  if (!hasFirebase) return null

  if (!info)
    return (
      <button
        type="button"
        disabled={status === 'loading'}
        onClick={() => load()}
        className="mt-4 flex w-full items-center gap-2 rounded-control border border-dashed border-line px-4 py-3 text-sm text-muted transition hover:bg-fg/[0.03]"
      >
        {status === 'loading' ? (
          <LoaderCircle aria-hidden className="size-4.5 animate-spin" />
        ) : (
          <Ticket aria-hidden className="size-4.5" />
        )}
        {status === 'loading' ? 'בודקים כרטיסים ומחירים…' : status === 'error' ? 'לא הצלחנו לבדוק. לנסות שוב?' : 'צריך כרטיס? כמה זה עולה?'}
      </button>
    )

  const official = safeHttpUrl(website)
  const needsTicket = info.entry === 'paid' || info.entry === 'partly'
  const rate = readCachedRate()
  const shekels = info.priceYen && rate ? Math.round(info.priceYen / rate.jpyPerIls) : null
  const showLinks =
    (needsTicket || info.bookAhead === 'required' || info.bookAhead === 'recommended') && (Boolean(official) || info.soldOnline)
  const canRemind = saved && !saved.booking && (info.bookAhead === 'required' || info.bookAhead === 'recommended')

  return (
    <section aria-label="כרטיסים ומחירים" className="surface mt-4 rounded-control p-4">
      <div className="flex items-center gap-2">
        <Ticket aria-hidden className="size-4.5 text-accent" />
        <p className="flex-1 text-sm font-semibold">כרטיסים ומחירים</p>
        <button
          type="button"
          aria-label="בדיקה מחדש"
          disabled={status === 'loading'}
          onClick={() => load(true)}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-fg/8"
        >
          <RefreshCw aria-hidden className={clsx('size-3.5', status === 'loading' && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {info.entry === 'free' && <Badge tone="good">כניסה חופשית</Badge>}
        {info.entry === 'partly' && <Badge tone="good">הכניסה חופשית, יש חלקים בתשלום</Badge>}
        {info.entry === 'paid' && (
          <Badge tone="neutral">
            {info.priceYen ? (
              <>
                בערך <bdi>{yen(info.priceYen)}</bdi> למבוגר{shekels ? <> (≈ ₪{shekels})</> : null}
              </>
            ) : (
              'בתשלום'
            )}
          </Badge>
        )}
        {info.entry === 'partly' && info.priceYen > 0 && (
          <Badge tone="neutral">
            החלק בתשלום: בערך <bdi>{yen(info.priceYen)}</bdi>
          </Badge>
        )}
        {info.bookAhead === 'required' && <Badge tone="warn">חובה להזמין מראש</Badge>}
        {info.bookAhead === 'recommended' && <Badge tone="caution">מומלץ להזמין מראש</Badge>}
        {info.entry === 'unknown' && <Badge tone="neutral">לא ידוע אם צריך כרטיס</Badge>}
      </div>

      <div className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {info.priceNote && <p>{info.priceNote}</p>}
        {info.bookAheadNote && <p>{info.bookAheadNote}</p>}
        {info.tip && (
          <p className="flex gap-2 rounded-control bg-amber-400/12 px-3 py-2 text-[13px]">
            <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {info.tip}
          </p>
        )}
      </div>

      {showLinks && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">איפה קונים</p>
          <div className="flex flex-wrap gap-2">
            {official && (
              <LinkButton href={official} primary>
                האתר הרשמי
              </LinkButton>
            )}
            {info.soldOnline &&
              BOOKING_SITES.map((site) => (
                <LinkButton key={site.name} href={site.url(info.englishName)}>
                  להשוות ב-{site.name}
                </LinkButton>
              ))}
          </div>
        </div>
      )}

      {canRemind && (
        <button
          type="button"
          onClick={() => {
            const latest = useTripStore.getState().placesById[saved.id]
            if (latest) actions.updatePlace(latest, { booking: { booked: false } }, 'נוספה תזכורת להזמנה')
          }}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent"
        >
          <BellPlus aria-hidden className="size-4" />
          תזכירו לנו להזמין
        </button>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {info.confident ? '' : 'לא בטוחים במידע הזה. '}המחירים משוערים ויכולים להשתנות, והמחיר הסופי מופיע באתר המכירה. באתרי ההזמנות יש
        לפעמים הנחה, אז שווה להשוות.
      </p>
    </section>
  )
}

function Badge({ tone, children }: { tone: 'good' | 'neutral' | 'warn' | 'caution'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'good' && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
        tone === 'neutral' && 'bg-fg/6 text-fg',
        tone === 'warn' && 'bg-red-500/12 text-red-700 dark:text-red-400',
        tone === 'caution' && 'bg-amber-400/15 text-amber-800 dark:text-amber-300',
      )}
    >
      {/* One piece of text: a flex badge would drop the spaces between its parts. */}
      <span>{children}</span>
    </span>
  )
}

function LinkButton({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-95',
        primary ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg',
      )}
    >
      <ExternalLink aria-hidden className="size-3.5" />
      {children}
    </a>
  )
}
