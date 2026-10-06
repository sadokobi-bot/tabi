import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { ArrowUp, ChevronLeft, LoaderCircle, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { LatLng } from '@/data/types'
import { askAssistant, resolveOnMap, type AssistantAnswer, type AssistantPlace } from '@/lib/assistant'
import { haptic } from '@/lib/haptics'
import type { PoiProvider } from '@/maps/poi'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

const EXAMPLES = ['המקדש עם אלפי השערים הכתומים', 'ראמן טוב ליד שיבויה', 'תצפית יפה על הר פוג׳י']

const GRADIENT = 'linear-gradient(135deg, #8b5cf6 0%, #e2553a 100%)'

interface AssistantProps {
  provider: PoiProvider | null
  near: LatLng | null
}

/** Floating AI helper on the map: describe a place, it finds it and offers to save it. */
export function Assistant({ provider, near }: AssistantProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null)
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error' | 'disabled'>('idle')
  const [resolving, setResolving] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)

  const ask = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || status === 'thinking') return
    const request = ++requestRef.current
    setText(trimmed)
    setStatus('thinking')
    setAnswer(null)
    inputRef.current?.blur()
    try {
      const result = await askAssistant(trimmed, near)
      if (request !== requestRef.current) return
      setAnswer(result)
      setStatus('idle')
    } catch (error) {
      console.error('[assistant]', error)
      const disabled = String((error as { code?: string } | null)?.code ?? '').includes('api-not-enabled')
      if (request === requestRef.current) setStatus(disabled ? 'disabled' : 'error')
    }
  }

  const show = async (place: AssistantPlace, index: number) => {
    haptic()
    setResolving(index)
    const controller = new AbortController()
    const poi = await resolveOnMap(place, provider, controller.signal).catch(() => null)
    setResolving(null)
    if (!poi) {
      ui.toast('לא הצלחנו למצוא את המקום במפה', 'error')
      return
    }
    setOpen(false)
    ui.moveCamera({ center: poi.location, zoom: 16 })
    const saved = useTripStore
      .getState()
      .places.find(
        (p) => (poi.osmId && p.osmId === poi.osmId) || (poi.googlePlaceId && p.googlePlaceId === poi.googlePlaceId) || p.name === poi.name,
      )
    if (saved) ui.openPlace(saved.id)
    else ui.openPoi(poi)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask(text)
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label="עוזר AI: חיפוש מקום"
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          haptic()
          setOpen(true)
        }}
        className="bottom-above-tabbar absolute start-4 z-10 grid size-14 place-items-center rounded-full text-white shadow-[0_14px_30px_-10px_rgb(139_92_246/0.8)]"
        style={{ background: GRADIENT }}
      >
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full opacity-20 motion-reduce:animate-none [animation-duration:2.6s]"
          style={{ background: GRADIENT }}
        />
        <Sparkles aria-hidden className="relative size-6" strokeWidth={2.2} />
      </motion.button>

      {/* Portaled: the map's tab panel is its own stacking context, under the tab bar. */}
      {createPortal(
        <BottomSheet open={open} onClose={() => setOpen(false)} label="עוזר AI">
          <div className="px-5 pb-4">
            <header className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-control text-white" style={{ background: GRADIENT }}>
                <Sparkles aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg leading-tight font-bold">לאן בא לכם?</h2>
                <p className="text-sm text-muted">תארו מקום ביפן, ואמצא אותו במפה</p>
              </div>
            </header>

            <form
              onSubmit={submit}
              className="mt-4 flex items-center gap-2 rounded-control border border-line bg-card/70 p-1.5 ps-4 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/12"
            >
              <input
                ref={inputRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="למשל: שוק אוכל רחוב באוסקה"
                aria-label="מה לחפש"
                enterKeyHint="search"
                maxLength={200}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
              />
              <button
                type="submit"
                aria-label="חיפוש"
                disabled={!text.trim() || status === 'thinking'}
                className="grid size-10 shrink-0 place-items-center rounded-inner text-white transition active:scale-90 disabled:opacity-40"
                style={{ background: GRADIENT }}
              >
                {status === 'thinking' ? (
                  <LoaderCircle aria-hidden className="size-5 animate-spin" />
                ) : (
                  <ArrowUp aria-hidden className="size-5" />
                )}
              </button>
            </form>

            <div className="mt-4 min-h-40" aria-live="polite">
              {status === 'thinking' && <Thinking />}

              {(status === 'error' || status === 'disabled') && (
                <p role="alert" className="rounded-control bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {status === 'disabled'
                    ? 'העוזר עוד לא הופעל. בעל הטיול צריך להפעיל את Firebase AI Logic.'
                    : 'העוזר לא זמין כרגע. נסו שוב בעוד רגע.'}
                </p>
              )}

              {status === 'idle' && !answer && (
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => void ask(example)}
                      className="rounded-full border border-line bg-card/70 px-3.5 py-2 text-sm font-medium transition hover:bg-fg/5 active:scale-95"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}

              {status === 'idle' && answer && (
                <div className="space-y-3">
                  {answer.reply && <p className="text-[15px] leading-relaxed">{answer.reply}</p>}
                  {answer.places.length > 0 && (
                    <ul className="space-y-2">
                      {answer.places.map((place, index) => (
                        <motion.li
                          key={`${place.searchName}${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.06 }}
                        >
                          <button
                            type="button"
                            onClick={() => void show(place, index)}
                            disabled={resolving != null}
                            className="surface flex w-full items-center gap-3 rounded-control p-3 text-start transition active:scale-[0.98]"
                          >
                            <CategoryIcon category={place.category} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{place.name}</span>
                              <span className="block text-xs leading-snug text-muted">{place.why}</span>
                            </span>
                            <span className={clsx('flex shrink-0 items-center gap-1 text-xs font-semibold text-accent')}>
                              {resolving === index ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : 'הצג במפה'}
                              {resolving !== index && <ChevronLeft aria-hidden className="size-4" />}
                            </span>
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <p className="mt-3 text-center text-[11px] text-muted">מבוסס Gemini. כדאי לוודא פרטים לפני שיוצאים לדרך.</p>
          </div>
        </BottomSheet>,
        document.body,
      )}
    </>
  )
}

function Thinking() {
  return (
    <div className="space-y-2" role="status" aria-label="מחפש">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Sparkles aria-hidden className="size-4 animate-pulse text-accent" />
        מחפש את המקום…
      </p>
      {[0, 1].map((i) => (
        <div key={i} className="surface flex items-center gap-3 rounded-control p-3">
          <span className="size-10 animate-pulse rounded-control bg-fg/8" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded-full bg-fg/8" />
            <span className="block h-3 w-4/5 animate-pulse rounded-full bg-fg/6" />
          </span>
        </div>
      ))}
    </div>
  )
}
