import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { ExternalLink, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { CONTACT_EMAIL, CONTACT_URL, PRIVACY, TERMS, TERMS_UPDATED, type LegalDoc } from '@/data/legal'

const useLegal = create<{ doc: LegalDoc | null }>(() => ({ doc: null }))

/** Opens the privacy policy or the terms of use, full screen (works before sign-in too). */
export const openLegal = (doc: LegalDoc) => useLegal.setState({ doc })
const closeLegal = () => useLegal.setState({ doc: null })

const TABS: { id: LegalDoc; label: string }[] = [
  { id: 'privacy', label: 'מדיניות פרטיות' },
  { id: 'terms', label: 'תנאי שימוש' },
]

/** The privacy policy and the terms of use, one tab each. Mounted once, at the app's root. */
export function LegalSheet() {
  const doc = useLegal((state) => state.doc)

  useEffect(() => {
    if (!doc) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && closeLegal()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doc])

  const sections = doc === 'terms' ? TERMS : PRIVACY

  return createPortal(
    <AnimatePresence>
      {doc && (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={doc === 'terms' ? 'תנאי שימוש' : 'מדיניות פרטיות'}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[90] flex flex-col bg-bg"
        >
          <header className="border-b border-line px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <div role="tablist" className="flex flex-1 gap-1 rounded-full bg-fg/6 p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={doc === tab.id}
                    onClick={() => openLegal(tab.id)}
                    className={clsx(
                      'flex-1 rounded-full py-2 text-sm font-semibold transition',
                      doc === tab.id ? 'bg-card shadow-sm' : 'text-muted',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="סגירה"
                onClick={closeLegal}
                className="tap-target relative grid size-10 shrink-0 place-items-center rounded-full hover:bg-fg/8"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <article key={doc} className="mx-auto max-w-2xl px-5 pt-5 pb-[max(env(safe-area-inset-bottom),2rem)]">
              <p className="text-xs text-muted">עודכן לאחרונה: {TERMS_UPDATED}</p>
              {sections.map((section) => (
                <section key={section.title} className="mt-5">
                  <h2 className="text-base font-bold">{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="mt-2 text-sm leading-relaxed text-fg/85">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
              <a
                href={CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : CONTACT_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
              >
                <ExternalLink aria-hidden className="size-4" />
                יצירת קשר
              </a>
            </article>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** "I agree to the terms of use and the privacy policy", with both linked. */
export function TermsConsent({ checked, onChange, error }: { checked: boolean; onChange: (value: boolean) => void; error?: boolean }) {
  return (
    <label
      className={clsx(
        'flex items-start gap-2.5 rounded-control px-1 py-1 text-sm leading-relaxed',
        error && 'bg-red-500/8 text-red-700 dark:text-red-300',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4.5 shrink-0 accent-[var(--color-accent)]"
      />
      <span>
        קראתי ואני מסכים/ה ל
        <button type="button" onClick={() => openLegal('terms')} className="font-semibold text-accent underline-offset-2 hover:underline">
          תנאי השימוש
        </button>{' '}
        ול
        <button type="button" onClick={() => openLegal('privacy')} className="font-semibold text-accent underline-offset-2 hover:underline">
          מדיניות הפרטיות
        </button>
      </span>
    </label>
  )
}
