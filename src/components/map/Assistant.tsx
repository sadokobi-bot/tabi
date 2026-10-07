import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Check, ChevronLeft, ImagePlus, LoaderCircle, MapPin, Sparkles, Star, X } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { actions } from '@/data/actions'
import type { LatLng } from '@/data/types'
import {
  askAssistant,
  extractPlaces,
  failureOf,
  resolveOnMap,
  type AssistantAnswer,
  type AssistantFailure,
  type AssistantPlace,
  type PromptImage,
} from '@/lib/assistant'
import { haptic } from '@/lib/haptics'
import type { Poi, PoiProvider } from '@/maps/poi'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

const EXAMPLES = ['המקדש עם אלפי השערים הכתומים', 'ראמן טוב ליד שיבויה', 'תצפית יפה על הר פוג׳י']

const FAILURE_TEXT: Record<AssistantFailure, string> = {
  disabled: 'העוזר עוד לא הופעל. בעל הטיול צריך להפעיל את Firebase AI Logic.',
  quota:
    'העוזר הגיע למכסה החינמית של Gemini. נסו שוב בעוד דקה. אם זה חוזר, המכסה היומית נגמרה, והיא מתחדשת כל יום ב-10:00 בבוקר (שעון ישראל).',
  busy: 'העוזר עמוס כרגע. נסו שוב בעוד דקה.',
  other: 'העוזר לא זמין כרגע. נסו שוב בעוד רגע.',
}

/** Longer text than a search (a pasted post) switches to import. */
const IMPORT_TEXT_LENGTH = 140

interface AssistantProps {
  provider: PoiProvider | null
  near: LatLng | null
}

interface ImportItem {
  place: AssistantPlace
  selected: boolean
  state: 'locating' | 'found' | 'approx' | 'saved'
  poi?: Poi
}

/** Shrinks a screenshot to a size Gemini reads well (and the free tier handles quickly). */
async function prepareImage(file: File): Promise<PromptImage & { preview: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const preview = canvas.toDataURL('image/jpeg', 0.85)
  return { data: preview.slice(preview.indexOf(',') + 1), mimeType: 'image/jpeg', preview }
}

const isSaved = (poi: Poi, name: string) =>
  useTripStore
    .getState()
    .places.some(
      (p) =>
        (poi.osmId && p.osmId === poi.osmId) ||
        (poi.googlePlaceId && p.googlePlaceId === poi.googlePlaceId) ||
        p.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )

/** Floating AI helper on the map: find a place from a description, or import every place in a post. */
export function Assistant({ provider, near }: AssistantProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState<(PromptImage & { preview: string }) | null>(null)
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null)
  const [items, setItems] = useState<ImportItem[] | null>(null)
  /** Real places from the map search for the question (Google Maps listings when Google is on). */
  const [results, setResults] = useState<Poi[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'thinking' | 'failed'>('idle')
  const [failure, setFailure] = useState<AssistantFailure>('other')
  const [importing, setImporting] = useState(false)
  const [resolving, setResolving] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)

  const wantsImport = Boolean(image) || text.trim().length > IMPORT_TEXT_LENGTH || text.trim().includes('\n')

  // Grow the box with pasted posts (up to ~6 lines).
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`
  }, [text])

  const fail = (error: unknown, request: number) => {
    console.error('[assistant]', error)
    if (request !== requestRef.current) return
    setFailure(failureOf(error))
    setStatus('failed')
  }

  const ask = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || status === 'thinking') return
    const request = ++requestRef.current
    setText(trimmed)
    setStatus('thinking')
    setImporting(false)
    setAnswer(null)
    setItems(null)
    setResults(null)
    inputRef.current?.blur()
    try {
      const result = await askAssistant(trimmed, near)
      if (request !== requestRef.current) return
      // Gemini understands the wish; the map search supplies the actual places.
      let found: Poi[] = []
      if (result.googleQuery && provider) {
        found = await provider.searchText(result.googleQuery, result.area ?? near, new AbortController().signal).catch(() => [])
        if (request !== requestRef.current) return
      }
      setResults(found.length > 0 ? found.slice(0, 5) : null)
      setAnswer(result)
      setStatus('idle')
    } catch (error) {
      fail(error, request)
    }
  }

  const importPost = async () => {
    if (status === 'thinking') return
    const request = ++requestRef.current
    setStatus('thinking')
    setImporting(true)
    setAnswer(null)
    setItems(null)
    setResults(null)
    inputRef.current?.blur()
    try {
      const result = await extractPlaces(text, image)
      if (request !== requestRef.current) return
      setAnswer(result)
      setStatus('idle')
      const initial: ImportItem[] = result.places.map((place) => ({ place, selected: true, state: 'locating' }))
      setItems(initial)
      // One at a time: gentle on the map search, and rows fill in as they resolve.
      const controller = new AbortController()
      for (const [index, item] of initial.entries()) {
        const poi = await resolveOnMap(item.place, provider, controller.signal).catch(() => null)
        if (request !== requestRef.current) return
        setItems(
          (current) =>
            current?.map((row, i) => {
              if (i !== index) return row
              if (!poi) return { ...row, state: 'approx', selected: false }
              if (isSaved(poi, row.place.name)) return { ...row, poi, state: 'saved', selected: false }
              return { ...row, poi, state: poi.key.startsWith('ai:') ? 'approx' : 'found' }
            }) ?? null,
        )
      }
    } catch (error) {
      fail(error, request)
    }
  }

  const saveSelected = () => {
    const chosen = (items ?? []).filter((item) => item.selected && item.poi)
    if (chosen.length === 0) return
    haptic()
    for (const { place, poi } of chosen) {
      actions.createPlace(
        {
          name: place.name,
          category: poi!.category === 'other' ? place.category : poi!.category,
          location: poi!.location,
          ...(place.address || poi!.address ? { address: place.address ?? poi!.address } : {}),
          ...(poi!.googlePlaceId ? { googlePlaceId: poi!.googlePlaceId } : {}),
          ...(poi!.osmId ? { osmId: poi!.osmId } : {}),
          ...(place.why ? { notes: place.why } : {}),
        },
        null,
      )
    }
    ui.toast(chosen.length === 1 ? 'מקום אחד נשמר ברעיונות' : `${chosen.length} מקומות נשמרו ברעיונות`)
    ui.moveCamera({ center: chosen[0]!.poi!.location, zoom: 13 })
    setOpen(false)
    setText('')
    setImage(null)
    setAnswer(null)
    setItems(null)
  }

  const openResult = (poi: Poi) => {
    haptic()
    setOpen(false)
    ui.moveCamera({ center: poi.location, zoom: 16 })
    const saved = useTripStore
      .getState()
      .places.find((p) => (poi.googlePlaceId && p.googlePlaceId === poi.googlePlaceId) || (poi.osmId && p.osmId === poi.osmId))
    if (saved) ui.openPlace(saved.id)
    else ui.openPoi(poi)
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

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (wantsImport) void importPost()
    else void ask(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !wantsImport) submit(event)
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    try {
      setImage(await prepareImage(file))
    } catch {
      ui.toast('לא הצלחנו לקרוא את התמונה', 'error')
    }
  }

  const locating = items?.some((item) => item.state === 'locating') ?? false
  const selectedCount = items?.filter((item) => item.selected && item.poi).length ?? 0

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
        className="glass bottom-above-tabbar absolute start-4 z-10 grid size-14 place-items-center rounded-full text-accent"
      >
        <Sparkles aria-hidden className="relative size-6" strokeWidth={2.2} />
      </motion.button>

      {/* Portaled: the map's tab panel is its own stacking context, under the tab bar. */}
      {createPortal(
        <BottomSheet open={open} onClose={() => setOpen(false)} label="עוזר AI">
          <div className="px-5 pb-4">
            <header className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
                <Sparkles aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg leading-tight font-bold">לאן בא לכם?</h2>
                <p className="text-sm text-muted">תארו מקום ביפן, או ייבאו פוסט שלם</p>
              </div>
            </header>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void pickImage(event.target.files?.[0])
                event.target.value = ''
              }}
            />

            {image && (
              <div className="mt-4 flex items-center gap-3 rounded-control bg-fg/5 p-2">
                <img src={image.preview} alt="" className="size-12 shrink-0 rounded-inner object-cover" />
                <span className="min-w-0 flex-1 text-sm font-medium">צילום מסך מצורף</span>
                <button
                  type="button"
                  aria-label="הסרת התמונה"
                  onClick={() => setImage(null)}
                  className="tap-target relative grid size-8 place-items-center rounded-full text-muted hover:bg-fg/8"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            )}

            <form
              onSubmit={submit}
              className="mt-4 flex items-end gap-2 rounded-control border border-line bg-card/70 p-1.5 ps-4 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/12"
            >
              <textarea
                ref={inputRef}
                value={text}
                rows={1}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={image ? 'הערה לפוסט (לא חובה)' : 'תארו מקום, או הדביקו פוסט'}
                aria-label="מה לחפש"
                enterKeyHint={wantsImport ? 'enter' : 'search'}
                maxLength={4000}
                dir={text ? 'auto' : 'rtl'}
                className="no-scrollbar min-w-0 flex-1 resize-none self-center bg-transparent py-2 text-base leading-snug outline-none placeholder:text-muted/70"
              />
              <button
                type="button"
                aria-label="צירוף צילום מסך"
                onClick={() => fileRef.current?.click()}
                className="grid size-10 shrink-0 place-items-center rounded-inner text-muted transition hover:bg-fg/6 active:scale-90"
              >
                <ImagePlus aria-hidden className="size-5" />
              </button>
              <button
                type="submit"
                aria-label={wantsImport ? 'ייבוא המקומות' : 'חיפוש'}
                disabled={(!text.trim() && !image) || status === 'thinking'}
                className="grid size-10 shrink-0 place-items-center rounded-inner bg-accent-fill text-accent-fg transition active:scale-90 disabled:opacity-40"
              >
                {status === 'thinking' ? (
                  <LoaderCircle aria-hidden className="size-5 animate-spin" />
                ) : (
                  <ArrowUp aria-hidden className="size-5" />
                )}
              </button>
            </form>

            <div className="mt-4 min-h-40" aria-live="polite">
              {status === 'thinking' && <Thinking label={importing ? 'קורא את הפוסט ומאתר את המקומות…' : 'מחפש את המקום…'} />}

              {status === 'failed' && (
                <p role="alert" className="rounded-control bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-700 dark:text-red-300">
                  {FAILURE_TEXT[failure]}
                </p>
              )}

              {status === 'idle' && !answer && (
                <>
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
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-4 flex w-full items-center gap-3 rounded-control border border-dashed border-line p-3 text-start transition hover:bg-fg/5 active:scale-[0.99]"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
                      <ImagePlus aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">ייבוא מפוסט</span>
                      <span className="block text-xs text-muted">צרפו צילום מסך מטיקטוק או אינסטגרם, ואשמור את כל המקומות שבו</span>
                    </span>
                  </button>
                </>
              )}

              {status === 'idle' && answer && items && (
                <div className="space-y-3">
                  <p className="text-[15px] leading-relaxed">
                    {items.length === 0 ? 'לא מצאתי מקומות ביפן בפוסט הזה.' : answer.reply || `מצאתי ${items.length} מקומות`}
                  </p>
                  <ul className="space-y-2">
                    {items.map((item, index) => (
                      <li key={`${item.place.searchName}${index}`}>
                        <label className="surface flex cursor-pointer items-start gap-3 rounded-control p-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={item.state === 'saved' || (item.state !== 'locating' && !item.poi)}
                            onChange={() =>
                              setItems(
                                (current) => current?.map((row, i) => (i === index ? { ...row, selected: !row.selected } : row)) ?? null,
                              )
                            }
                            className="mt-2.5 size-5 shrink-0"
                          />
                          <CategoryIcon category={item.place.category} className="size-10" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{item.place.name}</span>
                            {item.place.why && <span className="line-clamp-2 block text-xs leading-snug text-muted">{item.place.why}</span>}
                            <ItemStatus item={item} />
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {items.length > 0 && (
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={locating || selectedCount === 0}
                      loading={locating}
                      onClick={saveSelected}
                    >
                      {locating ? 'מאתר במפה' : selectedCount === 1 ? 'שמירת מקום אחד' : `שמירת ${selectedCount} מקומות`}
                    </Button>
                  )}
                </div>
              )}

              {status === 'idle' && answer && !items && results && (
                <div className="space-y-3">
                  {answer.reply && <p className="text-[15px] leading-relaxed">{answer.reply}</p>}
                  <ul className="space-y-2">
                    {results.map((poi, index) => (
                      <motion.li
                        key={poi.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <button
                          type="button"
                          onClick={() => openResult(poi)}
                          className="surface flex w-full items-center gap-3 rounded-control p-3 text-start transition active:scale-[0.98]"
                        >
                          <CategoryIcon category={poi.category} />
                          <span className="min-w-0 flex-1">
                            <span dir="auto" className="block truncate font-semibold">
                              {poi.name}
                            </span>
                            {poi.rating != null && (
                              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                <Star aria-hidden className="size-3.5 fill-amber-400 text-amber-400" />
                                <span className="font-semibold text-fg tabular-nums">{poi.rating.toFixed(1)}</span>
                                {poi.ratingCount != null && (
                                  <span className="tabular-nums">({poi.ratingCount.toLocaleString('he-IL')})</span>
                                )}
                              </span>
                            )}
                            {poi.address && (
                              <span dir="auto" className="block truncate text-xs text-muted">
                                {poi.address}
                              </span>
                            )}
                          </span>
                          <ChevronLeft aria-hidden className="size-4 shrink-0 text-muted" />
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {status === 'idle' && answer && !items && !results && (
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
                            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
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

function ItemStatus({ item }: { item: ImportItem }) {
  if (item.state === 'locating') {
    return (
      <span className="mt-1 flex items-center gap-1 text-xs text-muted">
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
        מאתר במפה
      </span>
    )
  }
  if (item.state === 'saved') {
    return (
      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-muted">
        <Check aria-hidden className="size-3.5" />
        כבר שמור בטיול
      </span>
    )
  }
  if (item.state === 'approx') {
    return (
      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <MapPin aria-hidden className="size-3.5" />
        {item.poi ? 'מיקום משוער, כדאי לבדוק במפה' : 'לא נמצא במפה'}
      </span>
    )
  }
  return (
    <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
      <MapPin aria-hidden className="size-3.5 shrink-0" />
      <span dir="auto" className="truncate">
        {item.poi?.address ?? item.place.address ?? item.place.city}
      </span>
    </span>
  )
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Sparkles aria-hidden className="size-4 animate-pulse text-accent" />
        {label}
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
