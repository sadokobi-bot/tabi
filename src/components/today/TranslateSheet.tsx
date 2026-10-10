import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Beef,
  Beer,
  CakeSlice,
  Camera,
  Drumstick,
  Fish,
  Flame,
  Ham,
  ImagePlus,
  Languages,
  Leaf,
  LoaderCircle,
  RotateCcw,
  Shrimp,
  type LucideIcon,
} from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import {
  FAILURE_TEXT,
  failureOf,
  translateImage,
  type AssistantFailure,
  type FoodTag,
  type PromptImage,
  type Translation,
} from '@/lib/assistant'
import { prepareImage } from '@/lib/image'

const TAGS: Record<FoodTag, { label: string; icon: LucideIcon; warn?: boolean }> = {
  spicy: { label: 'חריף', icon: Flame, warn: true },
  pork: { label: 'חזיר', icon: Ham, warn: true },
  beef: { label: 'בקר', icon: Beef },
  chicken: { label: 'עוף', icon: Drumstick },
  seafood: { label: 'פירות ים / דגים', icon: Shrimp, warn: true },
  raw: { label: 'נא', icon: Fish, warn: true },
  vegetarian: { label: 'צמחוני', icon: Leaf },
  alcohol: { label: 'אלכוהול', icon: Beer },
  sweet: { label: 'מתוק', icon: CakeSlice },
}

type Phase =
  | { name: 'pick' }
  | { name: 'working'; preview: string }
  | { name: 'done'; preview: string; result: Translation }
  | { name: 'error'; preview: string; failure: AssistantFailure }

/** Photo of a menu, sign or label → what it says, in Hebrew (Gemini through Firebase AI Logic). */
export function TranslateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Portaled: tab panels are their own stacking contexts, under the tab bar.
  return createPortal(
    <BottomSheet open={open} onClose={onClose} label="תרגום תמונה">
      {open && <Translate />}
    </BottomSheet>,
    document.body,
  )
}

function Translate() {
  const [phase, setPhase] = useState<Phase>({ name: 'pick' })
  const [question, setQuestion] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const lastImage = useRef<PromptImage | null>(null)

  const run = async (image: PromptImage, preview: string) => {
    lastImage.current = image
    setPhase({ name: 'working', preview })
    try {
      setPhase({ name: 'done', preview, result: await translateImage(image, question) })
    } catch (error) {
      console.error('[translate] failed', error)
      setPhase({ name: 'error', preview, failure: failureOf(error) })
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { preview, ...image } = await prepareImage(file, 1600)
      await run(image, preview)
    } catch {
      setPhase({ name: 'error', preview: '', failure: 'other' })
    }
  }

  const pickers = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </>
  )

  return (
    <div className="px-5 pb-6">
      {pickers}
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
          <Languages className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight">מה כתוב פה?</h2>
          <p className="text-sm text-muted">צלמו תפריט, שלט או אריזה, ונסביר בעברית</p>
        </div>
      </header>

      {phase.name === 'pick' && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-card bg-accent-fill font-semibold text-accent-fg shadow-accent transition active:scale-[0.97]"
            >
              <Camera aria-hidden className="size-8" />
              צילום
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="surface flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-card font-semibold transition active:scale-[0.97]"
            >
              <ImagePlus aria-hidden className="size-8 text-accent" />
              מהגלריה
            </button>
          </div>
          <TextField
            label="שאלה נוספת (לא חובה)"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="למשל: מה לא חריף? יש משהו בלי חזיר?"
            maxLength={200}
          />
        </div>
      )}

      {phase.name !== 'pick' && phase.preview && (
        <img src={phase.preview} alt="התמונה ששלחתם" className="mt-5 max-h-40 w-full rounded-control object-cover" />
      )}

      {phase.name === 'working' && (
        <p role="status" className="mt-5 flex items-center justify-center gap-2 py-6 text-sm font-medium text-muted">
          <LoaderCircle aria-hidden className="size-5 animate-spin" /> קוראים ומתרגמים…
        </p>
      )}

      {phase.name === 'error' && (
        <div className="py-6 text-center">
          <p className="text-sm text-muted">{FAILURE_TEXT[phase.failure]}</p>
          <div className="mt-4 flex justify-center gap-2">
            {lastImage.current && phase.preview && (
              <Button variant="secondary" onClick={() => void run(lastImage.current!, phase.preview)}>
                לנסות שוב
              </Button>
            )}
            <Button variant="ghost" onClick={() => setPhase({ name: 'pick' })}>
              תמונה אחרת
            </Button>
          </div>
        </div>
      )}

      {phase.name === 'done' && (
        <div className="mt-4">
          {phase.result.title && <h3 className="text-lg font-bold">{phase.result.title}</h3>}
          {phase.result.summary && <p className="mt-1 text-sm leading-relaxed">{phase.result.summary}</p>}

          {phase.result.items.length > 0 && (
            <ul className="mt-4 space-y-2">
              {phase.result.items.map((item, index) => (
                <li key={index} className="surface rounded-control p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.hebrew}</p>
                      {item.original && (
                        <p lang="ja" className="mt-0.5 text-xs text-muted">
                          {item.original}
                        </p>
                      )}
                    </div>
                    {item.price && (
                      <span className="shrink-0 rounded-full bg-fg/6 px-2.5 py-1 text-xs font-semibold tabular-nums" dir="ltr">
                        {item.price}
                      </span>
                    )}
                  </div>
                  {item.note && <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.note}</p>}
                  {item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => {
                        const { label, icon: Icon, warn } = TAGS[tag]
                        return (
                          <span
                            key={tag}
                            className={
                              warn
                                ? 'inline-flex items-center gap-1 rounded-full bg-amber-400/15 py-0.5 ps-1.5 pe-2 text-xs font-medium text-amber-800 dark:text-amber-300'
                                : 'inline-flex items-center gap-1 rounded-full bg-fg/6 py-0.5 ps-1.5 pe-2 text-xs font-medium'
                            }
                          >
                            <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-center text-xs text-muted">תרגום של AI, יכולות להיות טעויות. באלרגיות כדאי לוודא עם הצוות.</p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            icon={<RotateCcw aria-hidden className="size-4" />}
            onClick={() => setPhase({ name: 'pick' })}
          >
            תמונה נוספת
          </Button>
        </div>
      )}
    </div>
  )
}
