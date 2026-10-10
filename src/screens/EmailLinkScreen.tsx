import { useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheckBig, Eye, EyeOff, Lock, LockKeyhole } from 'lucide-react'
import { errorMessage, type EmailLinkMode } from '@/backend'
import { oniStill } from '@/components/brand/FrameLoop'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { getBackend } from '@/store/session'

const MODES: EmailLinkMode[] = ['resetPassword', 'verifyEmail', 'verifyAndChangeEmail', 'recoverEmail']

/** A link from one of our e-mails (Firebase adds ?mode=…&oobCode=… to the app's address), or null. */
export function readEmailLink(): { mode: EmailLinkMode; code: string } | null {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode') as EmailLinkMode | null
  const code = params.get('oobCode')
  return mode && code && MODES.includes(mode) ? { mode, code } : null
}

type Phase =
  | { name: 'checking' }
  | { name: 'password'; email: string | null }
  | { name: 'done'; email: string | null }
  | { name: 'error'; message: string }

/**
 * Where the links in Tabi's e-mails land: choosing a new password, or confirming a recovery
 * e-mail. In Hebrew and in the app's look, instead of Firebase's generic page.
 */
export function EmailLinkScreen({ mode, code }: { mode: EmailLinkMode; code: string }) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const reset = mode === 'resetPassword'

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const { email } = await getBackend().checkEmailLink(mode, code)
        if (reset) {
          if (alive) setPhase({ name: 'password', email })
          return
        }
        // Confirming an e-mail needs nothing more from them: do it right away.
        await getBackend().completeEmailLink(mode, code)
        if (alive) setPhase({ name: 'done', email })
      } catch (error) {
        if (alive) setPhase({ name: 'error', message: errorMessage(error) })
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [mode, code, reset])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const found = {
      password: password.length < 6 ? 'לפחות 6 תווים' : undefined,
      confirm: confirm !== password ? 'הסיסמאות לא תואמות' : undefined,
    }
    setErrors(found)
    if (found.password || found.confirm || phase.name !== 'password') return
    setBusy(true)
    try {
      await getBackend().completeEmailLink(mode, code, password)
      setPhase({ name: 'done', email: phase.email })
    } catch (error) {
      setPhase({ name: 'error', message: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  // Into the app, without the link in the address. A new password or e-mail means signing in again.
  const finish = async () => {
    if (phase.name === 'done')
      await getBackend()
        .signOut()
        .catch(() => undefined)
    window.location.replace(import.meta.env.BASE_URL)
  }

  const title =
    phase.name === 'error'
      ? 'הקישור לא עבד'
      : phase.name === 'done'
        ? reset
          ? 'הסיסמה עודכנה'
          : mode === 'recoverEmail'
            ? 'המייל הקודם שוחזר'
            : 'המייל אושר'
        : reset
          ? 'בחירת סיסמה חדשה'
          : 'מאשרים את המייל…'

  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] -translate-y-1/3 rounded-full bg-accent/14 blur-3xl"
      />
      <main className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <header className="flex flex-col items-center text-center">
          <img src={oniStill(phase.name === 'error' ? 'cover' : 'guide')} alt="" aria-hidden className="size-36 object-contain" />
          <p className="mt-2 text-sm font-semibold text-muted">
            Tabi <span className="text-accent">旅</span>
          </p>
          <h1 className="mt-3 text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
        </header>

        <div className="mt-6">
          {phase.name === 'checking' && (
            <div className="space-y-3" aria-busy>
              <div className="h-12 animate-pulse rounded-control bg-fg/6" />
              <div className="h-12 animate-pulse rounded-control bg-fg/6" />
            </div>
          )}

          {phase.name === 'password' && (
            <form onSubmit={(event) => void save(event)} noValidate className="surface space-y-4 rounded-card p-5">
              {phase.email && (
                <p className="text-sm text-muted">
                  לחשבון של <bdi dir="ltr">{phase.email}</bdi>
                </p>
              )}
              <TextField
                label="סיסמה חדשה"
                leading={<Lock className="size-[18px]" />}
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                hint="לפחות 6 תווים"
                autoComplete="new-password"
                dir="ltr"
                trailing={
                  <button
                    type="button"
                    aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShow((value) => !value)}
                    className="tap-target relative grid size-9 place-items-center rounded-inner text-muted hover:bg-fg/6"
                  >
                    {show ? <EyeOff aria-hidden className="size-4.5" /> : <Eye aria-hidden className="size-4.5" />}
                  </button>
                }
              />
              <TextField
                label="אימות הסיסמה"
                leading={<LockKeyhole className="size-[18px]" />}
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                error={errors.confirm}
                autoComplete="new-password"
                dir="ltr"
              />
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                שמירת הסיסמה
              </Button>
            </form>
          )}

          {phase.name === 'done' && (
            <div className="surface rounded-card p-5 text-center">
              <CircleCheckBig aria-hidden className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-3 leading-relaxed">
                {reset ? (
                  <>מעכשיו נכנסים עם {phase.email ? <bdi dir="ltr">{phase.email}</bdi> : 'המייל שלכם'} והסיסמה החדשה.</>
                ) : mode === 'recoverEmail' ? (
                  'כתובת המייל של החשבון חזרה להיות הקודמת. אם לא אתם שיניתם אותה, כדאי לבחור סיסמה חדשה.'
                ) : (
                  <>
                    {phase.email ? <bdi dir="ltr">{phase.email}</bdi> : 'המייל'} נוסף לחשבון. מעכשיו נכנסים איתו (במקום שם המשתמש), ואם
                    תשכחו את הסיסמה נשלח אליו קישור לאיפוס.
                  </>
                )}
              </p>
              <Button size="lg" className="mt-5 w-full" onClick={() => void finish()}>
                {reset || mode !== 'recoverEmail' ? 'להתחברות' : 'לאפליקציה'}
              </Button>
            </div>
          )}

          {phase.name === 'error' && (
            <div className="surface rounded-card p-5 text-center">
              <CircleAlert aria-hidden className="mx-auto size-10 text-amber-600 dark:text-amber-400" />
              <p className="mt-3 leading-relaxed">{phase.message}</p>
              <p className="mt-2 text-sm text-muted">
                {reset ? 'במסך הכניסה, ״שכחתי סיסמה״ שולח קישור חדש.' : 'בפרופיל, תחת ״החשבון שלי״, אפשר לשלוח קישור חדש.'}
              </p>
              <Button size="lg" variant="secondary" className="mt-5 w-full" onClick={() => void finish()}>
                לאפליקציה
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
