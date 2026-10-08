import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, HardDrive, Lock, LockKeyhole, User } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { AppError, errorMessage } from '@/backend'
import { checkUsername } from '@/backend/username'
import { SakuraDrift } from '@/components/brand/SakuraDrift'
import { LuckyCat, type CatMood } from '@/components/brand/LuckyCat'
import { SunGate } from '@/components/brand/SunGate'
import { ProfileFields, validateProfile, type ProfileDraft, type ProfileErrors } from '@/components/profile/ProfileFields'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useSession } from '@/store/session'

type Mode = 'signIn' | 'signUp'

/** Username + password sign-in; sign-up in two short steps (who you are, then the account). */
export function AuthScreen() {
  const backend = useSession((state) => state.backend)
  const [mode, setMode] = useState<Mode>('signIn')
  const [step, setStep] = useState<1 | 2>(1)
  const [profile, setProfile] = useState<ProfileDraft>({ firstName: '', lastName: '', gender: null })
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [suggestSignUp, setSuggestSignUp] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    password?: string
    confirm?: string
  }>({})

  const switchMode = (next: Mode) => {
    setMode(next)
    setStep(1)
    setFormError(null)
    setSuggestSignUp(false)
    setFieldErrors({})
    setProfileErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!backend) return
    setFormError(null)
    setSuggestSignUp(false)

    if (mode === 'signUp' && step === 1) {
      const errors = validateProfile(profile)
      setProfileErrors(errors)
      if (Object.keys(errors).length === 0) setStep(2)
      return
    }

    if (mode === 'signUp') {
      const check = checkUsername(username)
      const errors = {
        username: check.ok ? undefined : check.reason,
        password: password.length < 6 ? 'לפחות 6 תווים' : undefined,
        confirm: confirm !== password ? 'הסיסמאות לא תואמות' : undefined,
      }
      setFieldErrors(errors)
      if (errors.username || errors.password || errors.confirm) return
    } else if (!username.trim() || !password) {
      setFieldErrors({
        username: username.trim() ? undefined : 'הקלידו שם משתמש',
        password: password ? undefined : 'הקלידו סיסמה',
      })
      return
    }

    setBusy(true)
    try {
      if (mode === 'signIn') await backend.signIn(username, password)
      else
        await backend.signUp(username, password, {
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim(),
          gender: profile.gender!,
        })
    } catch (error) {
      setFormError(errorMessage(error))
      setSuggestSignUp(mode === 'signIn' && error instanceof AppError && error.code === 'invalid-credentials')
    } finally {
      setBusy(false)
    }
  }

  const signIn = mode === 'signIn'
  const details = !signIn && step === 1

  // What the cat does and says follows the form.
  const name = profile.firstName.trim()
  const catMood: CatMood = !details && passwordFocused ? (showPassword ? 'peek' : 'cover') : 'wave'
  const catLine = details
    ? name
      ? `נעים מאוד, ${name}!`
      : 'היי! בואו נכיר 👋'
    : passwordFocused
      ? showPassword
        ? 'טוב, רק הצצה קטנה 👀'
        : 'אני לא מציץ, מבטיח 🙈'
      : `${name}, עוד רגע מסיימים!`

  return (
    // Pinned to the screen like the app shell (AppLayout): on iOS home-screen apps 100dvh can exceed
    // the visible area, which leaves the page a little room to scroll. The header gives up space first.
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* Warm haze behind the sun, as on the launch screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/14 blur-3xl"
      />
      {/* Petals start once the intro has settled. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
      >
        <SakuraDrift />
      </motion.div>
      <div aria-hidden className="status-blend absolute inset-x-0 top-0 h-24" />

      <header className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 text-center">
        {signIn ? (
          // Shared with the launch screen: the sun glides up into place.
          <motion.div layoutId="sun-gate" transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <SunGate className="size-24" />
          </motion.div>
        ) : (
          // Sign-up has a guide: a lucky cat that waves hello and looks away from passwords.
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex items-end gap-1"
          >
            <LuckyCat mood={catMood} className="size-28 shrink-0 [@media(max-height:760px)]:size-20 [@media(max-height:640px)]:size-14" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={catLine}
                role="status"
                initial={{ opacity: 0, scale: 0.8, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                style={{ transformOrigin: 'bottom right' }}
                className="glass relative mb-16 max-w-[11rem] [@media(max-height:760px)]:mb-10 [@media(max-height:640px)]:hidden rounded-2xl rounded-br-md px-3.5 py-2 text-start text-sm font-semibold"
              >
                {catLine}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {signIn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { delay: 0.1 } }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-4 text-[1.75rem] leading-none font-bold tracking-tight">
                Tabi <span className="font-medium text-accent">旅</span>
              </p>
              <p className="mt-2 text-sm text-muted">הטיול שלנו ליפן, במקום אחד</p>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-md rounded-t-[2rem] border-t border-line bg-card px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] shadow-[0_-16px_48px_-24px_rgb(0_0_0/0.3)] sm:mb-10 sm:rounded-[2rem] sm:border"
      >
        <motion.div
          key={`${mode}-${step}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-5"
        >
          {!signIn && (
            <div className="mb-3 flex items-center gap-3">
              <div aria-hidden className="flex flex-1 gap-1.5">
                <span className="h-1 flex-1 rounded-full bg-accent-fill" />
                <span className={clsx('h-1 flex-1 rounded-full transition-colors', step === 2 ? 'bg-accent-fill' : 'bg-fg/10')} />
              </div>
              <span className="text-xs font-medium text-muted">שלב {step} מתוך 2</span>
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{signIn ? 'שמחים לראות אתכם שוב' : details ? 'נעים להכיר' : 'פרטי החשבון'}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {signIn
              ? 'התחברו כדי להמשיך לתכנן את הטיול'
              : details
                ? 'ספרו לנו מי אתם, כדי שהשותפים לטיול ידעו'
                : `${profile.firstName.trim()}, בחרו שם משתמש וסיסמה לכניסה`}
          </p>
        </motion.div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {details ? (
            <ProfileFields
              draft={profile}
              errors={profileErrors}
              onChange={(patch) => {
                setProfile((current) => ({ ...current, ...patch }))
                setProfileErrors({})
              }}
            />
          ) : (
            <>
              <TextField
                label="שם משתמש"
                leading={<User className="size-[18px]" />}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                error={fieldErrors.username}
                hint={signIn ? undefined : 'עברית או אנגלית, 2-16 תווים'}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={16}
              />
              <TextField
                label="סיסמה"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                leading={<Lock className="size-[18px]" />}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
                autoComplete={signIn ? 'current-password' : 'new-password'}
                dir="ltr"
                trailing={
                  <button
                    type="button"
                    aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                    // Keep the focus (and the keyboard) in the password field while toggling.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((value) => !value)}
                    className="tap-target relative grid size-9 place-items-center rounded-inner text-muted hover:bg-fg/6"
                  >
                    {showPassword ? <EyeOff aria-hidden className="size-4.5" /> : <Eye aria-hidden className="size-4.5" />}
                  </button>
                }
              />
              <AnimatePresence initial={false}>
                {!signIn && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    // Room for the focus ring, which the height animation would otherwise clip.
                    className="-mx-1 -mt-1 overflow-hidden px-1 pt-1"
                  >
                    <TextField
                      label="אימות סיסמה"
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      leading={<LockKeyhole className="size-[18px]" />}
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      error={fieldErrors.confirm}
                      autoComplete="new-password"
                      dir="ltr"
                      className="mb-1"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {formError && (
            <div role="alert" className="rounded-control bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {formError}
              {suggestSignUp && (
                <button type="button" onClick={() => switchMode('signUp')} className="ms-1 font-semibold underline">
                  אין לכם חשבון? הרשמה
                </button>
              )}
            </div>
          )}

          <Button type="submit" size="lg" className="mt-2 w-full" loading={busy}>
            {signIn ? 'כניסה' : details ? 'המשך' : 'יצירת חשבון'}
          </Button>
        </form>

        {!signIn && step === 2 ? (
          <p className="mt-4 text-center text-sm text-muted">
            <button type="button" onClick={() => setStep(1)} className="tap-target relative font-semibold text-accent">
              חזרה לפרטים האישיים
            </button>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-muted">
            {signIn ? 'עוד אין לכם חשבון?' : 'כבר יש לכם חשבון?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(signIn ? 'signUp' : 'signIn')}
              className="tap-target relative font-semibold text-accent"
            >
              {signIn ? 'הרשמה' : 'התחברות'}
            </button>
          </p>
        )}

        {backend?.mode === 'local' && (
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <HardDrive aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            מצב מקומי: החשבון והנתונים נשמרים בדפדפן הזה בלבד. אחרי חיבור לענן (Firebase) כולם יסתנכרנו בין המכשירים.
          </p>
        )}
      </motion.main>
    </div>
  )
}
