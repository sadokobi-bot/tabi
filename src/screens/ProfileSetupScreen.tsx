import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { errorMessage } from '@/backend'
import { SunGate } from '@/components/brand/SunGate'
import { ProfileFields, validateProfile, type ProfileDraft, type ProfileErrors } from '@/components/profile/ProfileFields'
import { Button } from '@/components/ui/Button'
import { getBackend, useCurrentUser } from '@/store/session'
import { useTripStore } from '@/store/trip'

/**
 * Accounts from before sign-up asked for a name: fill it in once. The name (and gender, for Hebrew
 * grammar) also replaces the username in the trips this user is in.
 */
export function ProfileSetupScreen() {
  const user = useCurrentUser()
  const [draft, setDraft] = useState<ProfileDraft>({ firstName: user.username, lastName: '', gender: null })
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateProfile(draft)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setError(null)
    try {
      await getBackend().saveProfile(
        user,
        { firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), gender: draft.gender! },
        useTripStore.getState().trips.map((trip) => trip.id),
      )
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] -translate-y-1/3 rounded-full bg-accent/14 blur-3xl"
      />
      <div aria-hidden className="status-blend absolute inset-x-0 top-0 h-24" />
      <form
        onSubmit={(event) => void save(event)}
        noValidate
        className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
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
          <SunGate className="size-16" />
          <h1 className="mt-5 text-[1.75rem] leading-tight font-bold tracking-tight">רגע לפני שממשיכים</h1>
          <p className="mt-2 max-w-xs text-muted">השלימו כמה פרטים, כדי שהשותפים לטיול ידעו מי אתם</p>
        </header>
        <div className="surface rounded-card p-5">
          <ProfileFields draft={draft} errors={errors} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
        </div>
        <div className="mt-auto pt-6">
          {error && (
            <p role="alert" className="mb-3 rounded-control bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            שמירה והמשך
          </Button>
        </div>
      </form>
    </div>
  )
}
