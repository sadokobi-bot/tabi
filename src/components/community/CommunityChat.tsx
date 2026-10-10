import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { EyeOff, Flag, Globe2, Lightbulb, MessagesSquare, SendHorizontal, ShieldCheck, Trash2, Users } from 'lucide-react'
import { errorMessage } from '@/backend'
import { useTabActive } from '@/app/tabActive'
import { Avatar } from '@/components/ui/Avatar'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import type { CommunityChannel, CommunityMessage } from '@/data/types'
import { getBackend, useCurrentUser } from '@/store/session'
import { ui, useUi } from '@/store/ui'

const MAX_LENGTH = 1000
/** A little more than the server's limit (8 s), so a quick second message is caught here first. */
const COOLDOWN_MS = 9000
const STICK_THRESHOLD = 120

const CHANNELS: { id: CommunityChannel; label: string; icon: typeof Globe2; placeholder: string; empty: string }[] = [
  {
    id: 'general',
    label: 'שיחה כללית',
    icon: MessagesSquare,
    placeholder: 'כתבו לקהילה…',
    empty: 'שאלו שאלה, ספרו לאן אתם נוסעים, או הכירו מטיילים אחרים.',
  },
  {
    id: 'tips',
    label: 'המלצות',
    icon: Lightbulb,
    placeholder: 'שתפו המלצה: מקום, מסעדה, טיפ…',
    empty: 'מקום שהפתיע אתכם? מסעדה ששווה את התור? טיפ שהייתם רוצים לדעת לפני? שתפו כאן.',
  },
]

/** The community's rules, agreed to once before joining. */
export const COMMUNITY_RULES = [
  'מכבדים את כולם: בלי עלבונות, הטרדות, גזענות או שנאה מכל סוג.',
  'שיח הדדי ונעים: מותר לא להסכים, בנימוס.',
  'נשארים בנושא: טיולים ליפן, שאלות, המלצות וחוויות.',
  'בלי פרסומות, ספאם או קישורים למכירה.',
  'שומרים על פרטיות: לא מפרסמים טלפונים, כתובות, מספרי דרכון או פרטים של אחרים.',
  'רואים משהו לא בסדר? מדווחים עליו. הודעות שמפרות את הכללים יימחקו, ומי שמפר אותם שוב ושוב ייחסם.',
]

const time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const day = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' })
const stamp = (ms: number) =>
  new Date(ms).toDateString() === new Date().toDateString() ? time.format(ms) : `${day.format(ms)} ${time.format(ms)}`

const hiddenKey = (uid: string) => `tabi:communityHidden:${uid}`
function readHidden(uid: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(hiddenKey(uid)) ?? '[]') as string[]
  } catch {
    return []
  }
}
function writeHidden(uid: string, ids: string[]) {
  try {
    localStorage.setItem(hiddenKey(uid), JSON.stringify(ids))
  } catch {
    // Storage unavailable: hidden for this visit only.
  }
}

/**
 * Tabi's community: rooms shared by everyone who uses the app (a general chat and recommendations),
 * open after agreeing to the rules. Messages can be reported, an author's messages hidden, and a
 * message deleted by its author or a moderator.
 */
export function CommunityChat({ switcher, wallpaper }: { switcher: ReactNode; wallpaper?: ReactNode }) {
  const user = useCurrentUser()
  const joined = user.communityAt != null
  const [channel, setChannel] = useState<CommunityChannel>('general')

  return (
    <div className="relative isolate flex h-full flex-col">
      {wallpaper}
      <header className="pt-screen mx-auto w-full max-w-md px-5 pb-3">
        {switcher}
        {joined && (
          <div role="tablist" aria-label="חדרים בקהילה" className="mt-3 flex gap-2">
            {CHANNELS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={channel === id}
                onClick={() => setChannel(id)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                  channel === id ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-muted hover:text-fg',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </button>
            ))}
          </div>
        )}
      </header>
      {joined ? <Room key={channel} channel={channel} /> : <JoinCommunity />}
    </div>
  )
}

function JoinCommunity() {
  const user = useCurrentUser()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)

  const join = async () => {
    setBusy(true)
    try {
      await getBackend().joinCommunity(user)
      ui.toast('ברוכים הבאים לקהילה! 🎌')
    } catch (error) {
      ui.toast(errorMessage(error), 'error')
      setBusy(false)
    }
  }

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-[calc(var(--tabbar-height)+var(--tabbar-bottom)+1rem)]">
      <div className="mx-auto w-full max-w-md px-5">
        <div className="surface rounded-card p-5">
          <span className="grid size-12 place-items-center rounded-full bg-accent/12 text-accent">
            <Users aria-hidden className="size-6" />
          </span>
          <h2 className="mt-3 text-xl font-bold">קהילת Tabi</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            מקום לשאול, להמליץ ולהכיר מטיילים אחרים ביפן. ההודעות כאן גלויות לכל משתמשי Tabi, ומופיע בהן רק השם הפרטי שלכם.
          </p>
          <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck aria-hidden className="size-4 text-accent" />
            הכללים שלנו
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            {COMMUNITY_RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/60" />
                {rule}
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 size-4.5 shrink-0 accent-[var(--color-accent)]"
            />
            קראתי את הכללים ואני מתחייב/ת לשמור עליהם
          </label>
          <Button className="mt-4 w-full" size="lg" disabled={!agreed} loading={busy} onClick={() => void join()}>
            הצטרפות לקהילה
          </Button>
        </div>
      </div>
    </div>
  )
}

function Room({ channel }: { channel: CommunityChannel }) {
  const user = useCurrentUser()
  const active = useTabActive()
  const config = CHANNELS.find((c) => c.id === channel)!
  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moderator, setModerator] = useState(false)
  const [hidden, setHidden] = useState<string[]>(() => readHidden(user.uid))
  const [selected, setSelected] = useState<CommunityMessage | null>(null)
  const [managingHidden, setManagingHidden] = useState(false)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const lastSent = useRef(0)
  const composing = useUi((state) => state.composing)

  useEffect(
    () =>
      getBackend().watchCommunity(
        channel,
        (next) => {
          setMessages(next)
          setLoaded(true)
          setError(null)
        },
        (failure) => {
          setLoaded(true)
          setError(errorMessage(failure))
        },
      ),
    [channel],
  )
  useEffect(() => {
    let alive = true
    void getBackend()
      .isCommunityModerator(user.uid)
      .then((value) => alive && setModerator(value))
    return () => {
      alive = false
    }
  }, [user.uid])

  const scrollToBottom = () => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight })
  }
  const visible = messages.filter((message) => !hidden.includes(message.authorId) || message.authorId === user.uid)
  const last = visible.at(-1)
  useLayoutEffect(() => {
    if (stickToBottom.current || last?.authorId === user.uid) scrollToBottom()
  }, [last?.id, last?.authorId, user.uid])
  useLayoutEffect(() => {
    if (active) {
      stickToBottom.current = true
      scrollToBottom()
    }
  }, [active])
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`
  }, [text])
  useEffect(() => () => ui.setComposing(false), [])
  useEffect(() => {
    if (!active) ui.setComposing(false)
  }, [active])

  const send = (event?: FormEvent) => {
    event?.preventDefault()
    const body = text.trim().slice(0, MAX_LENGTH)
    if (!body) return
    if (Date.now() - lastSent.current < COOLDOWN_MS) {
      ui.toast('רגע, אפשר לשלוח הודעה לקהילה פעם בכמה שניות')
      return
    }
    lastSent.current = Date.now()
    setText('')
    stickToBottom.current = true
    getBackend()
      .postCommunity(user, channel, body)
      .catch((failure: unknown) => {
        setText((current) => current || body)
        ui.toast(errorMessage(failure), 'error')
      })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event)
  }

  const hideAuthor = (message: CommunityMessage) => {
    const next = [...new Set([...hidden, message.authorId])]
    setHidden(next)
    writeHidden(user.uid, next)
    ui.toast(`ההודעות של ${message.authorName} מוסתרות אצלכם`)
  }

  const unhideAuthor = (authorId: string) => {
    const next = hidden.filter((id) => id !== authorId)
    setHidden(next)
    writeHidden(user.uid, next)
    if (next.length === 0) setManagingHidden(false)
  }
  const hiddenNames = new Map(messages.map((message) => [message.authorId, message.authorName]))

  return (
    <>
      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_THRESHOLD
        }}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-end px-4 pt-6 pb-3">
          {hidden.length > 0 && (
            <button
              type="button"
              onClick={() => setManagingHidden(true)}
              className="surface mb-3 flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-xs text-muted"
            >
              <span>מוסתרות הודעות של {hidden.length === 1 ? 'משתמש אחד' : `${hidden.length} משתמשים`}</span>
              <span className="font-semibold text-accent">ניהול</span>
            </button>
          )}
          {error && (
            <p role="alert" className="mb-3 rounded-control bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {loaded && visible.length === 0 && !error && (
            <div className="my-auto flex flex-col items-center px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-accent/12 text-accent">
                <config.icon aria-hidden className="size-7" />
              </span>
              <p className="mt-4 font-semibold">עוד אין כאן הודעות</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{config.empty}</p>
            </div>
          )}
          {visible.map((message, index) => {
            const mine = message.authorId === user.uid
            const previous = visible[index - 1]
            const sameAuthor = previous?.authorId === message.authorId && message.createdAt - previous.createdAt < 5 * 60_000
            return (
              <div
                key={message.id}
                className={clsx('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', sameAuthor ? 'mt-1' : 'mt-3')}
              >
                {!mine && (
                  <span className="w-7 shrink-0">{!sameAuthor && <Avatar name={message.authorName} className="size-7 text-xs" />}</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(message)}
                  aria-label={`הודעה מ${mine ? 'כם' : message.authorName}: ${message.text}`}
                  className={clsx(
                    'max-w-[78%] min-w-0 rounded-card px-3.5 py-2 text-start shadow-sm transition active:scale-[0.99]',
                    mine ? 'rounded-ee-sm bubble-mine' : 'surface rounded-es-sm',
                    message.pending && 'opacity-70',
                  )}
                >
                  {!mine && !sameAuthor && <span className="mb-0.5 block text-xs font-semibold text-accent">{message.authorName}</span>}
                  <span dir="auto" className="block text-[15px] leading-snug break-words whitespace-pre-wrap">
                    {message.text}
                  </span>
                  <span className="mt-0.5 block text-end text-[10px] text-muted">{stamp(message.createdAt)}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <form
        onSubmit={send}
        className="mx-auto w-full max-w-md px-4 pt-1"
        style={{
          paddingBottom: composing
            ? 'max(0.5rem, env(safe-area-inset-bottom))'
            : 'calc(var(--tabbar-height) + var(--tabbar-bottom) + 0.75rem)',
        }}
      >
        <div className="glass flex items-end gap-1.5 rounded-card p-1.5 ps-3">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            // The tab bar steps aside while typing, so the box sits right above the keyboard.
            onFocus={() => ui.setComposing(true)}
            onBlur={() => ui.setComposing(false)}
            rows={1}
            maxLength={MAX_LENGTH}
            dir={text ? 'auto' : 'rtl'}
            enterKeyHint="send"
            placeholder={config.placeholder}
            aria-label="הודעה לקהילה"
            className="no-scrollbar max-h-33 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-snug outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="שליחה לקהילה"
            onPointerDown={(event) => event.preventDefault()}
            className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-fill text-accent-fg transition active:scale-90 disabled:opacity-40"
          >
            <SendHorizontal aria-hidden className="size-[18px] -scale-x-100" />
          </button>
        </div>
      </form>

      <BottomSheet open={managingHidden} onClose={() => setManagingHidden(false)} label="משתמשים מוסתרים">
        <div className="px-5 pb-4">
          <h2 className="text-lg font-bold">משתמשים מוסתרים</h2>
          <p className="mt-1 text-sm text-muted">ההודעות שלהם לא מוצגות לכם. ההסתרה היא רק אצלכם.</p>
          <ul className="mt-4 space-y-2">
            {hidden.map((authorId) => (
              <li key={authorId} className="surface flex items-center gap-3 rounded-control px-3.5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{hiddenNames.get(authorId) ?? 'משתמש מוסתר'}</span>
                <button
                  type="button"
                  onClick={() => unhideAuthor(authorId)}
                  className="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent"
                >
                  ביטול הסתרה
                </button>
              </li>
            ))}
          </ul>
        </div>
      </BottomSheet>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} label="פעולות על ההודעה">
        {selected && (
          <MessageActions
            message={selected}
            mine={selected.authorId === user.uid}
            moderator={moderator}
            onDone={() => setSelected(null)}
            onHide={() => hideAuthor(selected)}
          />
        )}
      </BottomSheet>
    </>
  )
}

const REASONS = ['תוכן פוגעני או גזעני', 'הטרדה', 'ספאם או פרסומת', 'פרטים אישיים של מישהו', 'אחר']

function MessageActions({
  message,
  mine,
  moderator,
  onDone,
  onHide,
}: {
  message: CommunityMessage
  mine: boolean
  moderator: boolean
  onDone: () => void
  onHide: () => void
}) {
  const user = useCurrentUser()
  const [reporting, setReporting] = useState(false)

  const remove = async () => {
    try {
      await getBackend().deleteCommunityMessage(message)
      ui.toast('ההודעה נמחקה')
    } catch (error) {
      ui.toast(errorMessage(error), 'error')
    }
    onDone()
  }
  const report = async (reason: string) => {
    try {
      await getBackend().reportCommunityMessage(user, message, reason)
      ui.toast('תודה! הדיווח נשלח ונבדוק אותו')
    } catch (error) {
      ui.toast(errorMessage(error), 'error')
    }
    onDone()
  }

  return (
    <div className="px-5 pt-1 pb-5">
      <p dir="auto" className="line-clamp-3 rounded-control bg-fg/5 px-3.5 py-2.5 text-sm leading-relaxed">
        {message.text}
      </p>
      {reporting ? (
        <>
          <p className="mt-4 text-sm font-semibold">למה לדווח על ההודעה?</p>
          <div className="mt-2 grid gap-2">
            {REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => void report(reason)}
                className="rounded-control border border-line px-4 py-3 text-start text-sm transition hover:bg-fg/5"
              >
                {reason}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 grid gap-2">
          {(mine || moderator) && (
            <ActionButton icon={Trash2} danger onClick={() => void remove()}>
              {mine ? 'מחיקת ההודעה' : 'מחיקת ההודעה (ניהול)'}
            </ActionButton>
          )}
          {!mine && (
            <>
              <ActionButton icon={Flag} onClick={() => setReporting(true)}>
                דיווח על ההודעה
              </ActionButton>
              <ActionButton
                icon={EyeOff}
                onClick={() => {
                  onHide()
                  onDone()
                }}
              >
                הסתרת ההודעות של {message.authorName}
              </ActionButton>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  icon: Icon,
  danger,
  onClick,
  children,
}: {
  icon: typeof Flag
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 rounded-control px-4 py-3 text-start text-sm font-semibold transition',
        danger ? 'bg-red-500/8 text-red-600 dark:text-red-400' : 'bg-fg/5 hover:bg-fg/8',
      )}
    >
      <Icon aria-hidden className="size-4.5" />
      {children}
    </button>
  )
}
