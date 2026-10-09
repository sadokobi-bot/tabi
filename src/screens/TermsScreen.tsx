import { useState } from 'react'
import { LogOut, ShieldCheck } from 'lucide-react'
import { errorMessage } from '@/backend'
import { TermsConsent } from '@/components/legal/LegalSheet'
import { Button } from '@/components/ui/Button'
import { TERMS_VERSION } from '@/data/legal'
import { getBackend, useCurrentUser } from '@/store/session'

/** Accounts from before the terms (or before a change to them) accept them once to continue. */
export function TermsScreen() {
  const user = useCurrentUser()
  const [agreed, setAgreed] = useState(false)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    if (!agreed) {
      setMissing(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await getBackend().acceptTerms(user, TERMS_VERSION)
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/14 blur-3xl"
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <nav className="flex h-10 items-center justify-end">
          <button
            type="button"
            onClick={() => void getBackend().signOut()}
            className="tap-target relative inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted transition hover:text-fg"
          >
            <LogOut aria-hidden className="size-4" /> יציאה
          </button>
        </nav>
        <header className="flex flex-col items-center py-8 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-accent/12 text-accent">
            <ShieldCheck aria-hidden className="size-8" />
          </span>
          <h1 className="mt-5 text-[1.75rem] leading-tight font-bold tracking-tight">פרטיות ותנאי שימוש</h1>
          <p className="mt-2 max-w-xs text-muted">
            הוספנו מדיניות פרטיות ותנאי שימוש, שמסבירים איזה מידע נשמר, מי רואה אותו ואיך מוחקים אותו. כדי להמשיך, צריך לאשר אותם.
          </p>
        </header>
        <div className="surface rounded-card p-4">
          <TermsConsent
            checked={agreed}
            error={missing && !agreed}
            onChange={(value) => {
              setAgreed(value)
              setMissing(false)
            }}
          />
        </div>
        <div className="mt-auto pt-6">
          {error && (
            <p role="alert" className="mb-3 rounded-control bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <Button size="lg" className="w-full" loading={busy} onClick={() => void accept()}>
            אישור והמשך
          </Button>
        </div>
      </div>
    </div>
  )
}
