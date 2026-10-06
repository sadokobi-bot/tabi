import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ListPlus, Maximize2, Phone, Plus, Volume2, X } from 'lucide-react'
import { errorMessage } from '@/backend'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EMERGENCY_NUMBERS, PHRASE_GROUPS, type Phrase } from '@/data/phrases'
import type { ChecklistItem } from '@/data/types'
import { haptic } from '@/lib/haptics'
import { newId } from '@/lib/ids'
import { getBackend, useCurrentUser } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui, useUi, type ToolId } from '@/store/ui'

const LABELS: Record<ToolId, string> = { phrases: 'מילון כיס', checklist: 'רשימות משותפות', emergency: 'חירום' }

/** The travel tools (phrasebook, shared checklist, emergency numbers), opened from the Today screen. */
export function ToolSheets() {
  const tool = useUi((state) => state.tool)
  // Keep the last tool rendered while the sheet animates out.
  const [shown, setShown] = useState<ToolId>('phrases')
  useEffect(() => {
    if (tool) setShown(tool)
  }, [tool])

  return (
    <BottomSheet open={tool != null} onClose={() => ui.openTool(null)} label={LABELS[tool ?? shown]}>
      {(tool ?? shown) === 'phrases' && <Phrasebook />}
      {(tool ?? shown) === 'checklist' && <Checklist />}
      {(tool ?? shown) === 'emergency' && <Emergency />}
    </BottomSheet>
  )
}

function SheetHeader({ kanji, title, subtitle }: { kanji: string; title: string; subtitle: string }) {
  return (
    <header className="px-5 pt-1 pb-3">
      <p className="flex items-baseline gap-2.5">
        <span lang="ja" className="font-jp text-xl font-extrabold text-accent">
          {kanji}
        </span>
        <span className="font-display text-2xl font-bold">{title}</span>
      </p>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </header>
  )
}

/* ── Phrasebook ─────────────────────────────────────────────────────────── */

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

function speakJapanese(text: string) {
  if (!canSpeak) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, '、'))
  utterance.lang = 'ja-JP'
  utterance.rate = 0.85
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('ja'))
  if (voice) utterance.voice = voice
  synth.speak(utterance)
}

function Phrasebook() {
  const [groupId, setGroupId] = useState(PHRASE_GROUPS[0]!.id)
  const [big, setBig] = useState<Phrase | null>(null)
  const group = PHRASE_GROUPS.find((g) => g.id === groupId) ?? PHRASE_GROUPS[0]!

  return (
    <div className="pb-4">
      <SheetHeader
        kanji="言葉"
        title="מילון כיס"
        subtitle={canSpeak ? 'נוגעים ברמקול כדי לשמוע, או מגדילים כדי להראות למישהו.' : 'מגדילים ביטוי כדי להראות אותו למישהו.'}
      />

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
        {PHRASE_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroupId(g.id)}
            aria-pressed={g.id === groupId}
            className={clsx(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition',
              g.id === groupId ? 'bg-fg text-bg' : 'bg-fg/6 text-fg hover:bg-fg/10',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <ul className="mx-5 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
        {group.phrases.map((phrase) => (
          <li key={phrase.ja} className="flex items-center gap-2 py-3 ps-4 pe-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{phrase.he}</p>
              <p lang="ja" className="mt-0.5 text-[15px] text-fg/85">
                {phrase.ja}
              </p>
              <p className="mt-0.5 text-xs text-muted">{phrase.say}</p>
            </div>
            {canSpeak && (
              <IconButton label={`השמעה: ${phrase.he}`} onClick={() => speakJapanese(phrase.ja)}>
                <Volume2 className="size-[18px]" />
              </IconButton>
            )}
            <IconButton label={`הגדלה: ${phrase.he}`} onClick={() => setBig(phrase)}>
              <Maximize2 className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>

      {/* Portal: the sheet is transformed, which would trap a fixed overlay inside it. */}
      {createPortal(
      <AnimatePresence>
        {big && (
          <motion.div
            role="dialog"
            aria-label={big.he}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="fixed inset-0 z-[60] flex flex-col bg-bg px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            onClick={() => setBig(null)}
          >
            <div className="paper-grain pointer-events-none absolute inset-0" />
            <button type="button" aria-label="סגירה" className="relative ms-auto grid size-11 place-items-center rounded-full bg-fg/6">
              <X aria-hidden className="size-5" />
            </button>
            <div className="relative flex flex-1 flex-col items-center justify-center text-center">
              <p lang="ja" className="text-[2.6rem] leading-[1.35] font-bold break-keep">
                {big.ja}
              </p>
              <p className="mt-6 text-lg text-muted">{big.he}</p>
            </div>
            {canSpeak && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  speakJapanese(big.ja)
                }}
                className="relative mx-auto flex h-13 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-fg"
              >
                <Volume2 aria-hidden className="size-5" />
                השמעה ביפנית
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-fg/6 hover:text-fg active:scale-90"
    >
      <span aria-hidden>{children}</span>
    </button>
  )
}

/* ── Shared checklist ───────────────────────────────────────────────────── */

const SUGGESTED = [
  'דרכון בתוקף לחצי שנה לפחות',
  'ביטוח נסיעות',
  'eSIM או ראוטר נייד',
  'למלא Visit Japan Web (קוד QR למכס ולהגירה)',
  'Suica או PASMO בארנק של הטלפון',
  'מתאם חשמל (שקע יפני A, 100V)',
  'מזומן בין: הרבה מקומות קטנים לא מקבלים כרטיס',
  'נעליים נוחות להליכה (הולכים שם המון)',
  'שקית קטנה לזבל: כמעט אין פחים ברחוב',
  'מגבת יד קטנה (בהרבה שירותים אין נייר לניגוב ידיים)',
  'להזמין מקומות בשינקאנסן / JR Pass',
  'לשמור את כתובות המלונות ביפנית',
]

function Checklist() {
  const trip = useTrip()
  const user = useCurrentUser()
  const items = useTripStore((state) => state.checklist)
  const [text, setText] = useState('')

  const sorted = useMemo(() => [...items].sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt), [items])
  const doneCount = items.filter((item) => item.done).length

  const save = (next: ChecklistItem[]) =>
    getBackend()
      .saveChecklistItems(trip.id, next)
      .catch((error: unknown) => ui.toast(errorMessage(error), 'error'))

  const add = (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    void save([{ id: newId(), text: value.slice(0, 200), done: false, doneBy: null, createdAt: Date.now() }])
    setText('')
  }

  const addSuggested = () => {
    const existing = new Set(items.map((item) => item.text))
    const now = Date.now()
    void save(
      SUGGESTED.filter((line) => !existing.has(line)).map((line, index) => ({
        id: newId(),
        text: line,
        done: false,
        doneBy: null,
        createdAt: now + index,
      })),
    )
  }

  const toggle = (item: ChecklistItem) => {
    haptic()
    void save([{ ...item, done: !item.done, doneBy: item.done ? null : user.username }])
  }

  return (
    <div className="pb-4">
      <SheetHeader kanji="持物" title="רשימות משותפות" subtitle="מה לארוז ומה לסדר לפני הטיסה. מה שמסמנים כאן מתעדכן אצל כל השותפים." />

      {items.length > 0 && (
        <div className="mx-5 mb-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/8">
            <motion.div
              className="h-full rounded-full bg-matcha"
              initial={false}
              animate={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted tabular-nums">
            {doneCount}/{items.length}
          </span>
        </div>
      )}

      <form onSubmit={add} className="mx-5 mb-3 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="להוסיף משהו לרשימה…"
          aria-label="פריט חדש"
          maxLength={200}
          className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-base outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          aria-label="הוספה"
          disabled={!text.trim()}
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-fg text-bg transition active:scale-90 disabled:opacity-35"
        >
          <Plus aria-hidden className="size-5" />
        </button>
      </form>

      <ul className="mx-5 space-y-1.5">
        <AnimatePresence initial={false}>
          {sorted.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-card py-2.5 ps-3 pe-1.5"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.text}
                onClick={() => toggle(item)}
                className={clsx(
                  'grid size-6 shrink-0 place-items-center rounded-full border-2 transition',
                  item.done ? 'border-matcha bg-matcha text-white' : 'border-fg/25',
                )}
              >
                {item.done && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
              </button>
              <span className="min-w-0 flex-1">
                <span className={clsx('block text-[15px] leading-snug', item.done && 'text-muted line-through decoration-fg/30')}>{item.text}</span>
                {item.done && item.doneBy && <span className="text-[11px] text-muted">סומן ע״י {item.doneBy}</span>}
              </span>
              <button
                type="button"
                aria-label={`מחיקה: ${item.text}`}
                onClick={() => void getBackend().deleteChecklistItem(trip.id, item.id).catch((e: unknown) => ui.toast(errorMessage(e), 'error'))}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted/70 transition hover:bg-fg/6 hover:text-fg"
              >
                <X aria-hidden className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {items.length < SUGGESTED.length && (
        <button
          type="button"
          onClick={addSuggested}
          className="mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-2xl border border-dashed border-fg/20 py-3 text-sm font-semibold text-fg/80 transition hover:bg-fg/4"
        >
          <ListPlus aria-hidden className="size-4.5" />
          {items.length ? 'להשלים מהרשימה המומלצת ליפן' : 'להתחיל עם רשימה מומלצת ליפן'}
        </button>
      )}
    </div>
  )
}

/* ── Emergency ──────────────────────────────────────────────────────────── */

function Emergency() {
  return (
    <div className="pb-4">
      <SheetHeader kanji="緊急" title="חירום" subtitle="נוגעים במספר כדי לחייג. כדאי להכיר את המסך הזה לפני שצריך אותו." />
      <ul className="mx-5 space-y-2">
        {EMERGENCY_NUMBERS.map((entry, index) => (
          <li key={entry.number}>
            <a
              href={`tel:${entry.number.replace(/[^\d+]/g, '')}`}
              className={clsx(
                'flex items-center gap-3 rounded-3xl border p-3.5 transition active:scale-[0.98]',
                index < 2 ? 'border-accent/30 bg-accent/8' : 'border-line bg-card',
              )}
            >
              <span
                className={clsx(
                  'grid size-11 shrink-0 place-items-center rounded-2xl',
                  index < 2 ? 'bg-accent text-accent-fg' : 'bg-fg/6 text-fg',
                )}
              >
                <Phone aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{entry.label}</span>
                <span className="block text-xs text-muted">{entry.note}</span>
              </span>
              <span className="font-display text-xl font-bold tabular-nums" dir="ltr">
                {entry.number}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => ui.openTool('phrases')}
        className="mx-5 mt-3 w-[calc(100%-2.5rem)] rounded-2xl bg-fg/6 py-3 text-sm font-semibold transition hover:bg-fg/10"
      >
        משפטי חירום ביפנית
      </button>
    </div>
  )
}
