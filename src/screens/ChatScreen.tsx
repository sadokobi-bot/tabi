import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { firstName } from '@/backend'
import { MessageCircle, Plus, Reply, SendHorizontal, WifiOff, X } from 'lucide-react'
import { useTabActive } from '@/app/tabActive'
import chatPattern from '@/assets/chat-pattern.svg?url'
import { AttachSheet } from '@/components/chat/AttachSheet'
import { CommunityChat } from '@/components/community/CommunityChat'
import { PinnedMeet, TypingIndicator } from '@/components/chat/ChatStatus'
import { MessageRow } from '@/components/chat/MessageRow'
import { Avatar } from '@/components/ui/Avatar'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { replyOf, sendChatMessage } from '@/data/chat'
import type { ChatMessage } from '@/data/types'
import { useOnline } from '@/hooks/useOnline'
import { useTabReselect } from '@/hooks/useTabReselect'
import { markChatRead } from '@/store/chatRead'
import { getBackend, useCurrentUser, useSession } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'

const MAX_LENGTH = 2000
/** Within this distance (px) of the bottom, new messages keep the list scrolled to the end. */
const STICK_THRESHOLD = 120
/** "Typing" is refreshed at most this often while writing. */
const TYPING_EVERY_MS = 4000

const dayFormat = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
const dayKey = (ms: number) => new Date(ms).toDateString()

function dayLabel(ms: number): string {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (dayKey(ms) === today.toDateString()) return 'היום'
  if (dayKey(ms) === yesterday.toDateString()) return 'אתמול'
  return dayFormat.format(ms)
}

type Room = 'trip' | 'community'
const ROOM_KEY = 'tabi:chatRoom'

/** A faint pattern of Japanese doodles (torii, sakura, Fuji, onigiri, ramen…), like a chat wallpaper. */
export function ChatWallpaper() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-fg opacity-[0.045] dark:opacity-[0.07]"
      style={{
        maskImage: `url("${chatPattern}")`,
        WebkitMaskImage: `url("${chatPattern}")`,
        maskSize: '260px 260px',
        WebkitMaskSize: '260px 260px',
      }}
    />
  )
}

/** The chat tab: the trip's own chat, or the community of everyone who uses Tabi. */
export default function ChatScreen() {
  const [room, setRoom] = useState<Room>(() => {
    try {
      return localStorage.getItem(ROOM_KEY) === 'community' ? 'community' : 'trip'
    } catch {
      return 'trip'
    }
  })
  const choose = (next: Room) => {
    setRoom(next)
    try {
      localStorage.setItem(ROOM_KEY, next)
    } catch {
      // Not remembered (private mode).
    }
  }
  const switcher = (
    <div>
      <h1 className="sr-only">צ׳אט</h1>
      <div role="tablist" aria-label="איזה צ׳אט" className="flex rounded-control bg-fg/6 p-1">
        {(
          [
            ['trip', 'הטיול שלנו'],
            ['community', 'קהילת Tabi'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={room === id}
            onClick={() => choose(id)}
            className={clsx(
              'h-9 flex-1 rounded-inner text-sm font-semibold transition',
              room === id ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
  return room === 'trip' ? <TripChat switcher={switcher} /> : <CommunityChat switcher={switcher} wallpaper={<ChatWallpaper />} />
}

/**
 * Group chat of the trip's members: text, shared places, meeting points and polls, with reactions,
 * "read" and "typing". Messages written without a connection appear immediately (marked as waiting)
 * and are delivered automatically once the phone is back online.
 */
function TripChat({ switcher }: { switcher: ReactNode }) {
  const user = useCurrentUser()
  const trip = useTrip()
  const messages = useTripStore((state) => state.messages)
  const messagesLoaded = useTripStore((state) => state.messagesLoaded)
  const chatError = useTripStore((state) => state.chatError)
  const read = useTripStore((state) => state.chatMeta.read)
  const mode = useSession((state) => state.backend?.mode)
  const active = useTabActive()
  const online = useOnline()
  const composing = useUi((state) => state.composing)
  const draft = useUi((state) => state.chatDraft)

  const [text, setText] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const [reactingId, setReactingId] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const typingSentAt = useRef(0)

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior })
  }

  // New messages: follow them if the user is already at the end (or just sent one).
  const lastMessage = messages.at(-1)
  useLayoutEffect(() => {
    if (stickToBottom.current || lastMessage?.authorId === user.uid) scrollToBottom()
  }, [lastMessage?.id, lastMessage?.authorId, user.uid])

  // The list changes size when the keyboard opens or closes (the tab bar comes back), a reply or place
  // bar appears, someone starts typing, or a message grows (reactions, a menu): stay on the newest.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom()
    })
    observer.observe(list)
    if (list.firstElementChild) observer.observe(list.firstElementChild)
    return () => observer.disconnect()
  }, [])

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

  // Tell the others how far we've read (for their "read" marks), once per new message.
  const myRead = read[user.uid] ?? 0
  const lastAt = lastMessage && !lastMessage.pending ? lastMessage.createdAt : 0
  useEffect(() => {
    if (!active || !online || lastAt <= myRead) return
    getBackend()
      .setChatRead(trip.id, user.uid, lastAt)
      .catch(() => undefined)
  }, [active, online, lastAt, myRead, trip.id, user.uid])

  const stopTyping = () => {
    if (!typingSentAt.current) return
    typingSentAt.current = 0
    getBackend()
      .setTyping(trip.id, user.uid, null)
      .catch(() => undefined)
  }

  const onText = (value: string) => {
    setText(value)
    const now = Date.now()
    if (!value.trim()) stopTyping()
    else if (now - typingSentAt.current > TYPING_EVERY_MS) {
      typingSentAt.current = now
      getBackend()
        .setTyping(trip.id, user.uid, now)
        .catch(() => undefined)
    }
  }

  // Leaving the tab while typing must bring the tab bar back (and stop "typing…").
  useEffect(() => {
    if (!active) {
      ui.setComposing(false)
      setReactingId(null)
    }
  }, [active])
  useEffect(() => () => ui.setComposing(false), [])

  // A place shared from elsewhere in the app: ready to send, with a comment if wanted.
  useEffect(() => {
    if (draft && active) {
      stickToBottom.current = true
      scrollToBottom()
    }
  }, [draft, active])

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
    const body = text.trim().slice(0, MAX_LENGTH)
    if (!body && !draft) return
    const reply = replyTo ? { replyTo: replyOf(replyTo) } : {}
    sendChatMessage(draft ? { kind: 'place', place: draft, text: body, ...reply } : { text: body, ...reply })
    ui.setChatDraft(null)
    setReplyTo(null)
    setText('')
    stopTyping()
    stickToBottom.current = true
    inputRef.current?.focus()
  }

  const startReply = (message: ChatMessage) => {
    setReplyTo(message)
    inputRef.current?.focus()
  }

  /** Scrolls to a quoted message and highlights it for a moment. */
  const jumpTo = (id: string) => {
    const row = document.getElementById(`message-${id}`)
    if (!row) {
      ui.toast('ההודעה המקורית ישנה מדי ולא מופיעה כאן')
      return
    }
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlashId(id)
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), 1400)
  }
  const deletedIds = new Set(messages.flatMap((message) => (message.deleted ? [message.id] : [])))

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event)
  }

  const othersIds = trip.memberIds.filter((uid) => uid !== user.uid)
  const others = othersIds.map((uid) => trip.members[uid]?.name ?? 'משתתף')

  // "Read" under the user's latest message: by whom, or by everyone.
  const lastMine = [...messages].reverse().find((message) => message.authorId === user.uid && !message.deleted)
  const readers = lastMine && !lastMine.pending ? othersIds.filter((uid) => (read[uid] ?? 0) >= lastMine.createdAt) : []
  const receipt =
    readers.length === 0
      ? null
      : readers.length === othersIds.length && othersIds.length > 1
        ? 'נקרא ע״י כולם'
        : `נקרא ע״י ${readers.map((uid) => (trip.members[uid]?.name ?? '').split(' ')[0]).join(', ')}`

  return (
    <div className="relative isolate flex h-full flex-col">
      <ChatWallpaper />
      <header className="pt-screen mx-auto w-full max-w-md lg:max-w-2xl px-5 pb-3">
        {switcher}
        <div className="mt-3 flex items-center gap-2.5">
          <div aria-hidden className="flex shrink-0 [&>*+*]:-ms-2">
            {[firstName(user), ...others].slice(0, 4).map((name, index) => (
              <Avatar key={index} name={name} className="size-8 text-xs ring-2 ring-bg" />
            ))}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">
              <bdi>{trip.name}</bdi>
            </p>
            <p className="truncate text-xs text-muted">
              {others.length ? [firstName(user), ...others].join(', ') : 'עדיין אין שותפים לטיול'}
            </p>
          </div>
        </div>
        {mode === 'cloud' && !online && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-control bg-amber-500/12 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300"
          >
            <WifiOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            אין חיבור כרגע. אפשר לכתוב כרגיל: ההודעות יישלחו לבד כשהחיבור יחזור.
          </p>
        )}
        {chatError && (
          <p role="alert" className="mt-3 rounded-control bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {chatError}
          </p>
        )}
        <div className="mt-3 empty:hidden">
          <PinnedMeet messages={messages} />
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_THRESHOLD
        }}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-md lg:max-w-2xl flex-col justify-end px-4 pt-14 pb-3">
          {messagesLoaded && messages.length === 0 && (
            <div className="my-auto flex flex-col items-center px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-accent/12 text-accent">
                <MessageCircle aria-hidden className="size-7" />
              </span>
              <p className="mt-4 font-semibold">עדיין אין הודעות</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {others.length
                  ? 'כתבו משהו לשותפים לטיול, או לחצו על + כדי לשתף מקום, לקבוע נקודת מפגש או לפתוח סקר.'
                  : 'הזמינו את השותפים לטיול עם קוד ההזמנה שבהגדרות (העיגול עם האות שלכם במסך "היום").'}
              </p>
              {mode === 'local' && <p className="mt-3 text-xs text-muted">מצב מקומי: ההודעות נשמרות רק בדפדפן הזה.</p>}
            </div>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
            return (
              <div key={message.id}>
                {newDay && (
                  <p className="my-3 text-center">
                    <span className="rounded-full bg-fg/6 px-3 py-1 text-[11px] font-medium text-muted">{dayLabel(message.createdAt)}</span>
                  </p>
                )}
                <MessageRow
                  message={message}
                  uid={user.uid}
                  trip={trip}
                  sameAuthor={!newDay && previous?.authorId === message.authorId}
                  receipt={message.id === lastMine?.id ? receipt : null}
                  reacting={reactingId === message.id}
                  onReacting={(open) => setReactingId(open ? message.id : null)}
                  onReply={() => startReply(message)}
                  quoteDeleted={message.replyTo ? deletedIds.has(message.replyTo.id) : false}
                  onJumpToQuote={jumpTo}
                  flash={flashId === message.id}
                />
              </div>
            )
          })}
        </div>
      </div>

      <TypingIndicator trip={trip} uid={user.uid} />
      <form
        onSubmit={send}
        className="mx-auto w-full max-w-md lg:max-w-2xl px-4 pt-1 transition-[padding] duration-200"
        style={{
          paddingBottom: composing
            ? 'max(0.5rem, env(safe-area-inset-bottom))'
            : 'calc(var(--tabbar-height) + var(--tabbar-bottom) + 0.75rem)',
        }}
      >
        {replyTo && (
          <div className="glass mb-2 flex items-center gap-3 rounded-card p-2 ps-3">
            <Reply aria-hidden className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 border-s-[3px] border-accent ps-2.5">
              <span className="block text-xs font-semibold text-accent">
                תשובה ל{replyTo.authorId === user.uid ? 'עצמך' : replyTo.authorName}
              </span>
              <span className="block truncate text-sm text-muted">
                <bdi>{replyOf(replyTo).text}</bdi>
              </span>
            </span>
            <button
              type="button"
              aria-label="ביטול התשובה"
              onClick={() => setReplyTo(null)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
            >
              <X aria-hidden className="size-4.5" />
            </button>
          </div>
        )}
        {draft && (
          <div className="glass mb-2 flex items-center gap-3 rounded-card p-2 ps-3">
            <CategoryIcon category={draft.category} className="size-9" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-muted">שיתוף מקום</span>
              <span className="block truncate text-sm font-semibold" dir="auto">
                {draft.name}
              </span>
            </span>
            <button
              type="button"
              aria-label="ביטול שיתוף המקום"
              onClick={() => ui.setChatDraft(null)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
            >
              <X aria-hidden className="size-4.5" />
            </button>
          </div>
        )}
        <div className="glass flex items-end gap-1.5 rounded-card p-1.5">
          <button
            type="button"
            aria-label="שיתוף מקום, נקודת מפגש או סקר"
            onClick={() => setAttachOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-control text-accent transition hover:bg-fg/6 active:scale-90"
          >
            <Plus aria-hidden className="size-5.5" />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => onText(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => ui.setComposing(true)}
            onBlur={() => {
              ui.setComposing(false)
              stopTyping()
            }}
            rows={1}
            maxLength={MAX_LENGTH}
            // Empty "auto" fields fall back to LTR in Safari, which flips the Hebrew placeholder.
            dir={text ? 'auto' : 'rtl'}
            enterKeyHint="send"
            placeholder={draft ? 'הוסיפו כמה מילים (לא חובה)…' : 'כתבו הודעה…'}
            aria-label="הודעה חדשה"
            className="no-scrollbar max-h-33 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-snug outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!text.trim() && !draft}
            aria-label="שליחה"
            // Keep focus in the input so the keyboard stays open between messages.
            onPointerDown={(event) => event.preventDefault()}
            className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-fill text-accent-fg transition active:scale-90 disabled:opacity-40"
          >
            <SendHorizontal aria-hidden className="size-[18px] -scale-x-100" />
          </button>
        </div>
      </form>
      <AttachSheet open={attachOpen} onClose={() => setAttachOpen(false)} />
    </div>
  )
}
