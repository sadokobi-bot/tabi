import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { Clock3, MessageCircle, SendHorizontal, WifiOff } from 'lucide-react'
import { errorMessage } from '@/backend'
import { useTabActive } from '@/app/tabActive'
import { Avatar } from '@/components/ui/Avatar'
import type { ChatMessage } from '@/data/types'
import { useOnline } from '@/hooks/useOnline'
import { useTabReselect } from '@/hooks/useTabReselect'
import { haptic } from '@/lib/haptics'
import { newId } from '@/lib/ids'
import { markChatRead } from '@/store/chatRead'
import { getBackend, useCurrentUser, useSession } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'

const MAX_LENGTH = 2000
/** Within this distance (px) of the bottom, new messages keep the list scrolled to the end. */
const STICK_THRESHOLD = 120

const timeFormat = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
const dayKey = (ms: number) => new Date(ms).toDateString()

function dayLabel(ms: number): string {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (dayKey(ms) === today.toDateString()) return 'היום'
  if (dayKey(ms) === yesterday.toDateString()) return 'אתמול'
  return dayFormat.format(ms)
}

/**
 * Group chat of the trip's members. Messages written without a connection appear immediately
 * (marked as waiting) and are delivered automatically once the phone is back online.
 */
export default function ChatScreen() {
  const user = useCurrentUser()
  const trip = useTrip()
  const messages = useTripStore((state) => state.messages)
  const messagesLoaded = useTripStore((state) => state.messagesLoaded)
  const chatError = useTripStore((state) => state.chatError)
  const mode = useSession((state) => state.backend?.mode)
  const active = useTabActive()
  const online = useOnline()
  const composing = useUi((state) => state.composing)

  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior })
  }

  // New messages: follow them if the user is already at the end (or just sent one).
  const lastMessage = messages.at(-1)
  useLayoutEffect(() => {
    if (stickToBottom.current || lastMessage?.authorId === user.uid) scrollToBottom()
  }, [lastMessage?.id, lastMessage?.authorId, user.uid])

  // Opening the tab jumps to the latest message and marks everything as read.
  useLayoutEffect(() => {
    if (active) {
      stickToBottom.current = true
      scrollToBottom()
    }
  }, [active])

  useEffect(() => {
    if (active && lastMessage) markChatRead(user.uid, trip.id, lastMessage.createdAt)
  }, [active, lastMessage, user.uid, trip.id])

  // Leaving the tab while typing must bring the tab bar back.
  useEffect(() => {
    if (!active) ui.setComposing(false)
  }, [active])
  useEffect(() => () => ui.setComposing(false), [])

  useTabReselect('chat', () => scrollToBottom('smooth'))

  // Grow the input with its content (up to ~5 lines).
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`
  }, [text])

  const send = (event?: FormEvent) => {
    event?.preventDefault()
    const body = text.trim()
    if (!body) return
    const message: ChatMessage = {
      id: newId(),
      authorId: user.uid,
      authorName: user.username,
      text: body.slice(0, MAX_LENGTH),
      createdAt: Date.now(),
    }
    haptic()
    setText('')
    stickToBottom.current = true
    // Not awaited: offline, the write is queued and the promise only settles once it reaches the server.
    getBackend()
      .sendMessage(trip.id, message)
      .catch((error: unknown) => ui.toast(`ההודעה לא נשלחה: ${errorMessage(error)}`, 'error'))
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event)
  }

  const others = trip.memberIds.filter((uid) => uid !== user.uid).map((uid) => trip.members[uid]?.name ?? 'משתתף')

  return (
    <div className="flex h-full flex-col">
      <header className="pt-screen mx-auto w-full max-w-md px-5 pb-3">
        <h1 className="text-[1.6rem] leading-tight font-bold">צ׳אט הטיול</h1>
        <p className="mt-0.5 truncate text-sm text-muted">
          {others.length ? [user.username, ...others].join(' · ') : 'עדיין אין שותפים לטיול'}
        </p>
        {mode === 'cloud' && !online && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-control bg-amber-500/12 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            <WifiOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            אין חיבור כרגע. אפשר לכתוב כרגיל: ההודעות יישלחו לבד כשהחיבור יחזור.
          </p>
        )}
        {chatError && (
          <p role="alert" className="mt-3 rounded-control bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {chatError}
          </p>
        )}
      </header>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_THRESHOLD
        }}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-end px-4 pb-3">
          {messagesLoaded && messages.length === 0 && (
            <div className="my-auto flex flex-col items-center px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-accent/12 text-accent">
                <MessageCircle aria-hidden className="size-7" />
              </span>
              <p className="mt-4 font-semibold">עדיין אין הודעות</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {others.length
                  ? 'כתבו משהו לשותפים לטיול.'
                  : 'הזמינו את השותפים לטיול עם קוד ההזמנה שבהגדרות (העיגול עם האות שלכם במסך "היום").'}
              </p>
              {mode === 'local' && (
                <p className="mt-3 text-xs text-muted">מצב מקומי: ההודעות נשמרות רק בדפדפן הזה.</p>
              )}
            </div>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const mine = message.authorId === user.uid
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
            const sameAuthor = !newDay && previous?.authorId === message.authorId

            return (
              <div key={message.id}>
                {newDay && (
                  <p className="my-3 text-center">
                    <span className="rounded-full bg-fg/6 px-3 py-1 text-[11px] font-medium text-muted">{dayLabel(message.createdAt)}</span>
                  </p>
                )}
                <div className={clsx('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', sameAuthor ? 'mt-1' : 'mt-3')}>
                  {!mine && (
                    <span className="w-7 shrink-0">{!sameAuthor && <Avatar name={message.authorName} className="size-7 text-xs" />}</span>
                  )}
                  <div
                    className={clsx(
                      'max-w-[78%] rounded-card px-3.5 py-2 shadow-sm',
                      mine ? 'rounded-ee-sm bg-accent-fill text-accent-fg' : 'surface rounded-es-sm',
                    )}
                  >
                    {!mine && !sameAuthor && <p className="mb-0.5 text-xs font-semibold text-accent">{message.authorName}</p>}
                    <p dir="auto" className="text-[15px] leading-snug break-words whitespace-pre-wrap">
                      {message.text}
                    </p>
                    <p className={clsx('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-accent-fg/75' : 'text-muted')}>
                      {message.pending && (
                        <>
                          <Clock3 aria-hidden className="size-3" />
                          <span>ממתינה לשליחה ·</span>
                        </>
                      )}
                      <span dir="ltr">{timeFormat.format(message.createdAt)}</span>
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <form
        onSubmit={send}
        className="mx-auto w-full max-w-md px-4 pt-2 transition-[padding] duration-200"
        style={{
          paddingBottom: composing
            ? 'max(0.5rem, env(safe-area-inset-bottom))'
            : 'calc(var(--tabbar-height) + var(--tabbar-bottom) + 0.75rem)',
        }}
      >
        <div className="glass flex items-end gap-2 rounded-card p-1.5 ps-4">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => ui.setComposing(true)}
            onBlur={() => ui.setComposing(false)}
            rows={1}
            maxLength={MAX_LENGTH}
            // Empty "auto" fields fall back to LTR in Safari, which flips the Hebrew placeholder.
            dir={text ? 'auto' : 'rtl'}
            enterKeyHint="send"
            placeholder="כתבו הודעה…"
            aria-label="הודעה חדשה"
            className="no-scrollbar max-h-33 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-snug outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="שליחה"
            // Keep focus in the input so the keyboard stays open between messages.
            onPointerDown={(event) => event.preventDefault()}
            className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-fill text-accent-fg transition active:scale-90 disabled:opacity-40"
          >
            <SendHorizontal aria-hidden className="size-[18px] -scale-x-100" />
          </button>
        </div>
      </form>
    </div>
  )
}
