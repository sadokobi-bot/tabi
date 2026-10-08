import { useRef } from 'react'
import clsx from 'clsx'
import { CheckCheck, Clock3, Copy } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { REACTIONS, reactTo } from '@/data/chat'
import type { ChatMessage, Trip } from '@/data/types'
import { haptic } from '@/lib/haptics'
import { ui } from '@/store/ui'
import { MeetCard, PlaceCard, PollCard } from './ChatCards'

const timeFormat = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' })
const LONG_PRESS_MS = 420

interface MessageRowProps {
  message: ChatMessage
  uid: string
  trip: Trip
  /** Same author as the message before (no avatar / name again). */
  sameAuthor: boolean
  /** "Read" line under the user's latest message. */
  receipt?: string | null
  reacting: boolean
  onReacting: (open: boolean) => void
}

/**
 * One message: text or a card (place, meeting point, poll). A long press (or right click) opens the
 * reactions; the reactions show under the bubble, and tapping one adds or removes yours.
 */
export function MessageRow({ message, uid, trip, sameAuthor, receipt, reacting, onReacting }: MessageRowProps) {
  const mine = message.authorId === uid
  const card = message.kind && message.kind !== 'text'
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  // A long press must not also tap what's under the finger (a poll answer, the place card).
  const swallowClick = useRef(false)

  const open = () => {
    haptic()
    swallowClick.current = true
    onReacting(true)
  }
  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }

  const reactions = Object.entries(message.reactions ?? {})
  const counts = REACTIONS.flatMap((emoji) => {
    const count = reactions.filter(([, value]) => value === emoji).length
    return count ? [{ emoji, count, mine: message.reactions?.[uid] === emoji }] : []
  })
  const myReaction = message.reactions?.[uid]

  const copy = async () => {
    onReacting(false)
    try {
      await navigator.clipboard.writeText(message.text)
      ui.toast('ההודעה הועתקה')
    } catch {
      ui.toast('לא הצלחנו להעתיק', 'error')
    }
  }

  return (
    <div className={clsx('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', sameAuthor ? 'mt-1' : 'mt-3')}>
      {!mine && <span className="w-7 shrink-0">{!sameAuthor && <Avatar name={message.authorName} className="size-7 text-xs" />}</span>}
      <div className={clsx('relative flex min-w-0 flex-col', card ? 'w-[82%]' : 'max-w-[78%]', mine ? 'items-end' : 'items-start')}>
        {reacting && (
          <>
            <div aria-hidden className="fixed inset-0 z-30" onPointerDown={() => onReacting(false)} />
            <div
              role="toolbar"
              aria-label="תגובה להודעה"
              className={clsx(
                'glass absolute bottom-full z-40 mb-1.5 flex items-center gap-0.5 rounded-full p-1 shadow-lg',
                mine ? 'end-0' : 'start-0',
              )}
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`תגובה ${emoji}`}
                  aria-pressed={myReaction === emoji}
                  onClick={() => {
                    reactTo(message, myReaction === emoji ? null : emoji)
                    onReacting(false)
                  }}
                  className={clsx(
                    'grid size-10 place-items-center rounded-full text-[1.4rem] leading-none transition active:scale-90',
                    myReaction === emoji && 'bg-accent/16',
                  )}
                >
                  {emoji}
                </button>
              ))}
              {message.text && (
                <button
                  type="button"
                  aria-label="העתקת ההודעה"
                  onClick={() => void copy()}
                  className="grid size-10 place-items-center rounded-full text-muted transition active:scale-90"
                >
                  <Copy aria-hidden className="size-4.5" />
                </button>
              )}
            </div>
          </>
        )}

        <div
          onPointerDown={(event) => {
            swallowClick.current = false
            start.current = { x: event.clientX, y: event.clientY }
            timer.current = setTimeout(open, LONG_PRESS_MS)
          }}
          onPointerMove={(event) => {
            if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) cancel()
          }}
          onPointerUp={cancel}
          onPointerCancel={cancel}
          onContextMenu={(event) => {
            event.preventDefault()
            cancel()
            open()
          }}
          onClickCapture={(event) => {
            if (!swallowClick.current) return
            swallowClick.current = false
            event.preventDefault()
            event.stopPropagation()
          }}
          className={clsx(
            'w-full rounded-card px-3.5 py-2 shadow-sm select-none [-webkit-touch-callout:none]',
            card
              ? clsx('surface', mine ? 'rounded-ee-sm ring-1 ring-accent/35' : 'rounded-es-sm')
              : mine
                ? 'rounded-ee-sm bg-accent-fill text-accent-fg'
                : 'surface rounded-es-sm',
            reacting && 'ring-2 ring-accent/40',
          )}
        >
          {!mine && !sameAuthor && <p className="mb-1 text-xs font-semibold text-accent">{message.authorName}</p>}
          {message.kind === 'place' && message.place && <PlaceCard place={message.place} messageId={message.id} />}
          {message.kind === 'meet' && message.meet && <MeetCard meet={message.meet} />}
          {message.kind === 'poll' && message.poll && <PollCard message={message} poll={message.poll} uid={uid} trip={trip} />}
          {message.text && (
            <p dir="auto" className={clsx('text-[15px] leading-snug break-words whitespace-pre-wrap', card && 'mt-2')}>
              {message.text}
            </p>
          )}
          <p className={clsx('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine && !card ? 'text-accent-fg/75' : 'text-muted')}>
            {message.pending && (
              <>
                <Clock3 aria-hidden className="size-3" />
                <span>ממתינה לשליחה ·</span>
              </>
            )}
            <span dir="ltr">{timeFormat.format(message.createdAt)}</span>
          </p>
        </div>

        {counts.length > 0 && (
          <div className={clsx('relative z-[1] -mt-1.5 flex flex-wrap gap-1', mine ? 'me-2' : 'ms-2')}>
            {counts.map(({ emoji, count, mine: chosen }) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${emoji} ${count}${chosen ? ', כולל שלך' : ''}`}
                aria-pressed={chosen}
                onClick={() => reactTo(message, chosen ? null : emoji)}
                className={clsx(
                  'flex h-6 items-center gap-0.5 rounded-full border px-1.5 text-[13px] leading-none shadow-sm',
                  chosen ? 'border-accent/50 bg-accent/12' : 'border-line bg-card',
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-[11px] font-semibold text-muted tabular-nums">{count}</span>}
              </button>
            ))}
          </div>
        )}

        {receipt && (
          <p className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-muted">
            <CheckCheck aria-hidden className="size-3.5 text-sky-500" />
            {receipt}
          </p>
        )}
      </div>
    </div>
  )
}
