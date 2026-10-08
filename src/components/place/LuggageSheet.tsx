import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CircleCheck, Copy, Languages, Luggage, Phone, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import { luggageSent, type HotelMove } from '@/data/luggage'
import { addDays, formatDay, isoDateInTz } from '@/lib/dates'
import { useCurrentUser } from '@/store/session'
import { ui } from '@/store/ui'
import { useLocalNames } from './DriverCard'

const guestNameKey = (uid: string) => `tabi:guestName:${uid}`

function recallGuestName(uid: string): string {
  try {
    return localStorage.getItem(guestNameKey(uid)) ?? ''
  } catch {
    return ''
  }
}

function rememberGuestName(uid: string, name: string) {
  try {
    localStorage.setItem(guestNameKey(uid), name)
  } catch {
    // Private mode: typed again next time.
  }
}

const jaDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  })

/**
 * Sending the suitcases ahead to the next hotel (takkyubin, 宅急便): hand them in at the front desk
 * the evening before, travel light, and find them waiting on arrival. Steps, a card in Japanese for
 * the front desk, and "sent" with the tracking number, shared with the trip.
 */
export function LuggageSheet({ move, onClose }: { move: HotelMove | null; onClose: () => void }) {
  return (
    <BottomSheet open={move !== null} onClose={onClose} label="שליחת מזוודות">
      {move && <LuggageBody key={`${move.from.id}:${move.to.id}`} move={move} />}
    </BottomSheet>
  )
}

function LuggageBody({ move }: { move: HotelMove }) {
  const user = useCurrentUser()
  const [guestName, setGuestName] = useState(() => recallGuestName(user.uid))
  const [tracking, setTracking] = useState('')
  const [card, setCard] = useState(false)
  const sent = luggageSent(move)
  const sendOn = addDays(move.date, -1)
  const day = (iso: string) => formatDay(iso, { weekday: 'long', day: 'numeric', month: 'long' })

  const markSent = () => {
    const number = tracking.trim()
    actions.updatePlace(
      move.to,
      { luggage: { sentOn: isoDateInTz(new Date()), fromId: move.from.id, ...(number ? { tracking: number } : {}) } },
      'סומן: המזוודות בדרך',
    )
  }

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(move.to.luggage?.tracking ?? '')
      ui.toast('מספר המעקב הועתק')
    } catch {
      ui.toast('לא הצלחנו להעתיק', 'error')
    }
  }

  return (
    <div className="px-5 pb-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
          <Luggage className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">שליחת מזוודות למלון הבא</h2>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <span className="truncate">{move.from.name}</span>
            <ArrowLeft aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{move.to.name}</span>
          </p>
        </div>
      </header>

      {sent ? (
        <div className="mt-5 rounded-control bg-emerald-500/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-5" />
            המזוודות בדרך אל {move.to.name}
          </p>
          <p className="mt-1 text-sm text-muted">נשלחו ב{day(move.to.luggage!.sentOn)}. בדרך כלל הן מחכות בקבלה כשמגיעים.</p>
          {move.to.luggage?.tracking && (
            <button type="button" onClick={copyTracking} className="mt-3 flex items-center gap-2 text-sm font-semibold">
              מספר מעקב:
              <span dir="ltr" className="tabular-nums">
                {move.to.luggage.tracking}
              </span>
              <Copy aria-hidden className="size-4 text-muted" />
            </button>
          )}
          <button
            type="button"
            onClick={() => actions.updatePlace(move.to, { luggage: undefined })}
            className="mt-3 text-xs font-medium text-muted"
          >
            ביטול הסימון
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          ביפן שולחים מזוודות ממלון למלון בזול ובקלות, ונוסעים ברכבת בלי לסחוב. ככה עושים את זה:
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {[
          <>
            <b>{day(sendOn)}, בערב:</b> מבקשים בקבלה של {move.from.name} לשלוח את המזוודות ב&quot;טַקְיוּבִּין&quot; (宅急便), ומראים להם את
            הכרטיס ביפנית שלמטה.
          </>,
          <>
            <b>משלמים במקום:</b> בערך 2,000–4,000 ין למזוודה, לפי הגודל והמרחק. על הקבלה יש מספר מעקב.
          </>,
          <>
            <b>{day(move.date)}:</b> המזוודות מגיעות אל {move.to.name} ומחכות בקבלה. למקומות רחוקים (הוקאידו, קיושו, אוקינאווה) זה יכול לקחת
            יום נוסף.
          </>,
          <>
            <b>ארזו תיק קטן</b> ללילה האחרון במלון {move.from.name} וליום הנסיעה.
          </>,
        ].map((step, index) => (
          <li key={index} className="flex gap-3 text-sm leading-relaxed">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-bold text-accent">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-control bg-amber-400/12 px-3.5 py-2.5 text-xs leading-relaxed">
        שכחתם לשלוח בערב? אפשר גם בבוקר היציאה, והמזוודות יגיעו יום אחרי. כמעט כל המלונות מקבלים מזוודות של אורחים לפני ההגעה, אבל לא מזיק
        לשאול.
      </p>

      <div className="mt-5 space-y-3">
        <TextField
          label="השם שלכם באנגלית, כמו בהזמנה"
          value={guestName}
          onChange={(event) => {
            setGuestName(event.target.value)
            rememberGuestName(user.uid, event.target.value.trim())
          }}
          dir="ltr"
          autoComplete="name"
          maxLength={60}
          hint="מופיע בכרטיס, כדי שהמלון הבא ידע של מי המזוודות"
        />
        <Button size="lg" className="w-full" icon={<Languages aria-hidden className="size-4.5" />} onClick={() => setCard(true)}>
          כרטיס ביפנית לקבלה
        </Button>
      </div>

      {!sent && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-semibold">שלחתם?</p>
          <div className="mt-2 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                label="מספר מעקב (לא חובה)"
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                dir="ltr"
                inputMode="numeric"
                maxLength={30}
              />
            </div>
            <Button size="lg" variant="secondary" onClick={markSent}>
              נשלח
            </Button>
          </div>
        </div>
      )}

      <FrontDeskCard move={move} guestName={guestName.trim()} open={card} onClose={() => setCard(false)} />
    </div>
  )
}

/** Black on white, large, in Japanese: everything the front desk needs to fill in the shipping slip. */
function FrontDeskCard({ move, guestName, open, onClose }: { move: HotelMove; guestName: string; open: boolean; onClose: () => void }) {
  const to = move.to
  const local = useLocalNames(to.googlePlaceId, open)
  const name = local?.name ?? to.name
  const address = to.hotel?.addressJa || local?.address || to.address
  const phone = to.hotel?.phone

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const rows: [string, string | undefined][] = [
    ['お届け先', name],
    ['住所', address],
    ['電話', phone],
    ['お届け希望日', jaDate(move.date)],
    ['宿泊者名', guestName || undefined],
    ['予約番号', to.hotel?.code],
  ]

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="כרטיס ביפנית לקבלה"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-white text-neutral-950"
        >
          <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <p className="text-sm text-neutral-500">הראו את המסך בקבלה</p>
            <button
              type="button"
              aria-label="סגירה"
              onClick={onClose}
              autoFocus
              className="tap-target relative grid size-11 place-items-center rounded-full bg-neutral-100 text-neutral-700"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <div lang="ja" dir="ltr" className="flex flex-1 flex-col justify-center px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
            <p className="text-center text-[1.65rem] leading-snug font-bold">この荷物を宅急便で次のホテルへ送りたいです。</p>
            <p className="mt-2 text-center text-lg text-neutral-500">{jaDate(move.date)}にチェックインします。</p>
            <dl className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
              {rows.map(([label, value]) =>
                value ? (
                  <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 py-3.5">
                    <dt className="text-base text-neutral-500">{label}</dt>
                    <dd className="text-xl leading-snug font-semibold break-words">
                      {label === '電話' ? (
                        <a href={`tel:${value.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 tabular-nums">
                          <Phone aria-hidden className="size-5" />
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
