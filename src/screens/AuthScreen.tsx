import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, HardDrive } from 'lucide-react'
import { motion } from 'motion/react'
import { AppError, errorMessage } from '@/backend'
import { checkUsername } from '@/backend/username'
import { BrandMark } from '@/components/brand/BrandMark'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useSession } from '@/store/session'

type Mode = 'signIn' | 'signUp'

/** Username + password sign-in and sign-up. No e-mail, no verification codes. */
export function AuthScreen() {
  const backend = useSession((state) => state.backend)
  const [mode, setMode] = useState<Mode>('signIn')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [suggestSignUp, setSuggestSignUp] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string; confirm?: string }>({})

  const switchMode = (next: Mode) => {
    setMode(next)
    setFormError(null)
    setSuggestSignUp(false)
    setFieldErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!backend) return
    setFormError(null)
    setSuggestSignUp(false)

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
      setFieldErrors({ username: username.trim() ? undefined : 'הקלידו שם משתמש', password: password ? undefined : 'הקלידו סיסמה' })
      return
    }

    setBusy(true)
    try {
      if (mode === 'signIn') await backend.signIn(username, password)
      else await backend.signUp(username, password)
    } catch (error) {
      setFormError(errorMessage(error))
      setSuggestSignUp(mode === 'signIn' && error instanceof AppError && error.code === 'invalid-credentials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AmbientBackground />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-7 flex flex-col items-center text-center">
          <BrandMark className="size-20" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Tabi</h1>
          <p className="mt-1 text-muted">הטיול שלנו ליפן, במקום אחד</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="glass rounded-[1.75rem] p-5"
        >
          <div role="tablist" aria-label="סוג כניסה" className="relative mb-5 grid grid-cols-2 rounded-2xl bg-fg/6 p-1">
            {(['signIn', 'signUp'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={clsx('relative h-10 rounded-xl text-sm font-semibold transition-colors', mode === value ? 'text-fg' : 'text-muted')}
              >
                {mode === value && (
                  <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-xl bg-card shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                )}
                <span className="relative">{value === 'signIn' ? 'התחברות' : 'הרשמה'}</span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField
              label="שם משתמש"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              error={fieldErrors.username}
              hint={mode === 'signUp' ? 'עברית או אנגלית, 2–16 תווים' : undefined}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={16}
            />
            <TextField
              label="סיסמה"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              dir="ltr"
              trailing={
                <button
                  type="button"
                  aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid size-9 place-items-center rounded-xl text-muted hover:bg-fg/6"
                >
                  {showPassword ? <EyeOff aria-hidden className="size-4.5" /> : <Eye aria-hidden className="size-4.5" />}
                </button>
              }
            />
            {mode === 'signUp' && (
              <TextField
                label="אימות סיסמה"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                error={fieldErrors.confirm}
                autoComplete="new-password"
                dir="ltr"
              />
            )}

            {formError && (
              <div role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {formError}
                {suggestSignUp && (
                  <button type="button" onClick={() => switchMode('signUp')} className="ms-1 font-semibold underline">
                    אין לכם חשבון? הרשמה
                  </button>
                )}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === 'signIn' ? 'כניסה' : 'יצירת חשבון'}
            </Button>
          </form>
        </motion.div>

        {backend?.mode === 'local' && (
          <p className="mt-5 flex items-start gap-2 px-2 text-xs leading-relaxed text-muted">
            <HardDrive aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            מצב מקומי: החשבון והנתונים נשמרים בדפדפן הזה בלבד. אחרי חיבור לענן (Firebase) כולם יסתנכרנו בין המכשירים.
          </p>
        )}
      </main>
    </div>
  )
}
