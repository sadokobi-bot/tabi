import { useState, type FormEvent } from 'react'
import { ChevronLeft, FileText, Lock, Mail, ShieldCheck, TriangleAlert, UserX } from 'lucide-react'
import { AppError, errorMessage, type SessionUser } from '@/backend'
import { openLegal } from '@/components/legal/LegalSheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { getBackend } from '@/store/session'
import { leftTrips, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/** "החשבון שלי": recovery e-mail, privacy and terms, deleting the account. */
export function AccountSection({ user, cloud }: { user: SessionUser; cloud: boolean }) {
  return (
    <div className="space-y-2">
      {cloud && <RecoveryEmail user={user} />}
      <ul className="surface divide-y divide-line rounded-card text-sm">
        <li>
          <button type="button" onClick={() => openLegal('privacy')} className="flex w-full items-center gap-3 px-4 py-3 text-start">
            <ShieldCheck aria-hidden className="size-4.5 text-muted" />
            <span className="flex-1">מדיניות פרטיות</span>
            <ChevronLeft aria-hidden className="size-4 text-muted" />
          </button>
        </li>
        <li>
          <button type="button" onClick={() => openLegal('terms')} className="flex w-full items-center gap-3 px-4 py-3 text-start">
            <FileText aria-hidden className="size-4.5 text-muted" />
            <span className="flex-1">תנאי שימוש</span>
            <ChevronLeft aria-hidden className="size-4 text-muted" />
          </button>
        </li>
      </ul>
      <DeleteAccount user={user} />
    </div>
  )
}

/** Here only the password was typed, so a wrong one is called just that. */
const passwordError = (error: unknown) =>
  error instanceof AppError && error.code === 'invalid-credentials' ? 'הסיסמה שגויה' : errorMessage(error)

const pendingKey = (uid: string) => `tabi:pendingEmail:${uid}`
function readPending(uid: string, confirmed: string | null | undefined): string | null {
  try {
    const pending = localStorage.getItem(pendingKey(uid))
    return pending && pending !== confirmed ? pending : null
  } catch {
    return null
  }
}
function writePending(uid: string, email: string) {
  try {
    localStorage.setItem(pendingKey(uid), email)
  } catch {
    // Not remembered (private mode).
  }
}

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/** Adds or changes the e-mail a password-reset link can be sent to. Asks for the password first. */
function RecoveryEmail({ user }: { user: SessionUser }) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)
  // Sent and not confirmed yet (remembered on this device until the e-mail shows up on the account).
  const [sentTo, setSentTo] = useState<string | null>(() => readPending(user.uid, user.email))

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const found = {
      email: looksLikeEmail(email) ? undefined : 'כתובת המייל לא תקינה',
      password: password ? undefined : 'הקלידו את הסיסמה',
    }
    setErrors(found)
    if (found.email || found.password) return
    setBusy(true)
    try {
      await getBackend().setRecoveryEmail(user, email, password)
      setSentTo(email.trim())
      writePending(user.uid, email.trim())
      setEditing(false)
      setPassword('')
    } catch (error) {
      setErrors({ password: passwordError(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface rounded-card p-4">
      <div className="flex items-start gap-3">
        <Mail aria-hidden className="mt-0.5 size-4.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">מייל לשחזור סיסמה</p>
          {user.email ? (
            <p className="mt-0.5 truncate text-muted" dir="ltr">
              {user.email}
            </p>
          ) : (
            <p className="mt-0.5 leading-relaxed text-muted">לא הוגדר. בלי מייל, סיסמה שנשכחה אי אפשר לשחזר.</p>
          )}
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="tap-target relative shrink-0 text-sm font-semibold text-accent">
            {user.email ? 'שינוי' : 'הוספה'}
          </button>
        )}
      </div>
      {sentTo && !editing && (
        <p
          role="status"
          className="mt-3 rounded-control bg-green-500/10 px-3 py-2 text-xs leading-relaxed text-green-800 dark:text-green-300"
        >
          ממתין לאישור: שלחנו קישור ל-<bdi dir="ltr">{sentTo}</bdi>. אחרי שתלחצו עליו, המייל יתווסף לחשבון ומאז נכנסים איתו (במקום שם
          המשתמש). לא הגיע? בדקו בספאם, או לחצו ״שינוי״ ושלחו שוב.
        </p>
      )}
      {editing && (
        <form onSubmit={(event) => void save(event)} noValidate className="mt-3 space-y-3">
          <TextField
            label="מייל"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
          />
          <TextField
            label="הסיסמה שלכם (לאישור)"
            type="password"
            leading={<Lock className="size-[18px]" />}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            autoComplete="current-password"
            dir="ltr"
          />
          <p className="text-xs leading-relaxed text-muted">נשלח קישור אימות למייל. אחרי האישור, נכנסים לאפליקציה עם המייל והסיסמה.</p>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={busy}>
              שליחת קישור אימות
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              ביטול
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

/** Deleting the account for good: a warning of what happens to each trip, and the password. */
function DeleteAccount({ user }: { user: SessionUser }) {
  const trips = useTripStore((state) => state.trips)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const owned = trips.filter((trip) => trip.ownerId === user.uid)
  const solo = owned.filter((trip) => trip.memberIds.length === 1)
  const shared = owned.filter((trip) => trip.memberIds.length > 1)

  const remove = async (event: FormEvent) => {
    event.preventDefault()
    if (!password) {
      setError('הקלידו את הסיסמה')
      return
    }
    setBusy(true)
    setError(null)
    trips.forEach((trip) => leftTrips.add(trip.id))
    try {
      await getBackend().deleteAccount(user, password, trips)
      ui.setProfileOpen(false)
      ui.toast('החשבון נמחק. תודה שטיילתם איתנו 🌸')
    } catch (caught) {
      trips.forEach((trip) => leftTrips.delete(trip.id))
      setError(passwordError(caught))
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-control py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/8 dark:text-red-400"
      >
        <UserX aria-hidden className="size-4" />
        מחיקת החשבון
      </button>
    )

  return (
    <form
      onSubmit={(event) => void remove(event)}
      noValidate
      role="alertdialog"
      aria-label="מחיקת החשבון"
      className="rounded-card border border-red-500/40 bg-red-500/[0.07] p-4"
    >
      <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
        <TriangleAlert aria-hidden className="size-5 shrink-0" />
        למחוק את החשבון לצמיתות?
      </p>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-relaxed">
        <li>הפרטים שלכם יימחקו, ואי אפשר יהיה להיכנס יותר עם שם המשתמש הזה.</li>
        {solo.length > 0 && (
          <li>
            {solo.length === 1 ? 'הטיול' : 'הטיולים'} {solo.map((trip) => `״${trip.name}״`).join(', ')}{' '}
            {solo.length === 1 ? 'יימחק' : 'יימחקו'}, כי רק אתם בהם.
          </li>
        )}
        {shared.length > 0 && <li>בטיולים משותפים שיצרתם, הניהול יעבור לשותף אחר.</li>}
        <li>מכל שאר הטיולים תצאו. המקומות וההודעות שהוספתם יישארו לשותפים.</li>
      </ul>
      <p className="mt-2 text-sm font-semibold">אי אפשר לבטל את זה.</p>
      <div className="mt-3">
        <TextField
          label="הסיסמה שלכם (לאישור)"
          type="password"
          leading={<Lock className="size-[18px]" />}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error}
          autoComplete="current-password"
          dir="ltr"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="danger" className="flex-1" loading={busy}>
          מחיקת החשבון לצמיתות
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setPassword('')
            setError(null)
          }}
        >
          ביטול
        </Button>
      </div>
    </form>
  )
}
