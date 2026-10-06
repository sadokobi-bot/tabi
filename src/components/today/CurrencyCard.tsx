import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { FX_REFRESH_MS, fetchRate, readCachedRate, type FxRate } from '@/lib/currency'
import { haptic } from '@/lib/haptics'

type Direction = 'jpy-to-ils' | 'ils-to-jpy'

const CURRENCY = {
  'jpy-to-ils': { from: '¥', to: '₪' },
  'ils-to-jpy': { from: '₪', to: '¥' },
} as const

const numberFormat = (maximumFractionDigits: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits })

/** Keeps digits and a single decimal point. */
function sanitize(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '')
  const [whole = '', ...fraction] = cleaned.split('.')
  return fraction.length ? `${whole.slice(0, 9)}.${fraction.join('').slice(0, 2)}` : whole.slice(0, 9)
}

/** Live rate, refreshed hourly and whenever the phone comes back online; the cached rate works offline. */
function useFxRate() {
  const [rate, setRate] = useState<FxRate | null>(readCachedRate)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const refresh = (force: boolean) => {
      const cached = readCachedRate()
      if (!force && cached && Date.now() - cached.fetchedAt < FX_REFRESH_MS) return
      fetchRate(controller.signal).then(
        (fresh) => {
          setRate(fresh)
          setFailed(false)
        },
        () => {
          if (!controller.signal.aborted) setFailed(true)
        },
      )
    }
    const onVisible = () => document.visibilityState === 'visible' && refresh(false)
    const onOnline = () => refresh(true)

    refresh(false)
    const timer = setInterval(() => refresh(true), FX_REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return { rate, failed }
}

/** Yen ↔ shekel converter with a live exchange rate. */
export function CurrencyCard() {
  const { rate, failed } = useFxRate()
  const [direction, setDirection] = useState<Direction>('jpy-to-ils')
  const [amount, setAmount] = useState('1000')
  const { from, to } = CURRENCY[direction]

  const value = Number(amount) || 0
  const converted = rate ? (direction === 'jpy-to-ils' ? value / rate.jpyPerIls : value * rate.jpyPerIls) : null
  const rateDate = rate ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' }).format(new Date(rate.date)) : null

  const swap = () => {
    haptic()
    if (converted != null) setAmount(sanitize(String(Math.round(converted * 100) / 100)))
    setDirection((current) => (current === 'jpy-to-ils' ? 'ils-to-jpy' : 'jpy-to-ils'))
  }

  // One slim row: amount on one side, the converted amount on the other, swap in the middle.
  return (
    <div className="surface rounded-3xl p-2.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" dir="ltr">
        <label className="flex h-12 min-w-0 items-center gap-1.5 rounded-2xl bg-fg/5 px-3.5 focus-within:ring-2 focus-within:ring-accent/40">
          <span aria-hidden className="text-base font-semibold text-muted">
            {from}
          </span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={amount}
            onChange={(event) => setAmount(sanitize(event.target.value))}
            onFocus={(event) => event.target.select()}
            aria-label={direction === 'jpy-to-ils' ? 'סכום בין' : 'סכום בשקלים'}
            className="w-full min-w-0 bg-transparent text-lg font-semibold tabular-nums outline-none"
          />
        </label>

        <button
          type="button"
          onClick={swap}
          aria-label={direction === 'jpy-to-ils' ? 'החלפה להמרה משקלים לין' : 'החלפה להמרה מין לשקלים'}
          className="grid size-10 place-items-center rounded-full bg-accent/12 text-accent transition hover:bg-accent/18 active:scale-90 active:rotate-180"
        >
          <ArrowLeftRight aria-hidden className="size-[18px]" />
        </button>

        <p className="flex h-12 min-w-0 items-center gap-1.5 truncate px-2 text-lg font-bold tabular-nums" aria-live="polite">
          <span className="text-base font-semibold text-muted">{to}</span>
          {converted == null ? (
            failed ? (
              <span className="text-sm font-medium text-muted">—</span>
            ) : (
              <span aria-hidden className="inline-block h-5 w-16 animate-pulse rounded-lg bg-fg/8" />
            )
          ) : (
            numberFormat(direction === 'jpy-to-ils' ? 2 : 0).format(converted)
          )}
        </p>
      </div>

      <p className="mt-1.5 px-1.5 text-[11px] text-muted">
        {rate ? (
          <>
            שער חי <span dir="ltr">₪1 = ¥{numberFormat(2).format(rate.jpyPerIls)}</span> · עודכן {rateDate}
          </>
        ) : failed ? (
          'אין חיבור לשער כרגע'
        ) : (
          'טוענים שער…'
        )}
      </p>
    </div>
  )
}
