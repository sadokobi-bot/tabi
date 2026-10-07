import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { ArrowRight, LogOut, Sparkles, Ticket } from 'lucide-react'
import { motion } from 'motion/react'
import { errorMessage } from '@/backend'
import { BrandMark } from '@/components/brand/BrandMark'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isoDateInTz } from '@/lib/dates'
import { normalizeInviteCode } from '@/lib/ids'
import { getBackend, useCurrentUser } from '@/store/session'
import { rememberActiveTrip, useTripStore } from '@/store/trip'

/** First run after sign-up (or "add a trip"): create a new trip or join a partner's with an invite code. */
export function OnboardingScreen() {
  const user = useCurrentUser()
  const hasTrips = useTripStore((state) => state.trips.length > 0)
  const [tab, setTab] = useState<'create' | 'join'>('create')

  const [name, setName] = useState(`יפן ${new Date().getFullYear()}`)
  const [startDate, setStartDate] = useState(() => isoDateInTz(new Date()))
  const [days, setDays] = useState('30')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activate = (tripId: string) => {
    rememberActiveTrip(user.uid, tripId)
    useTripStore.setState({ activeTripId: tripId, creatingTrip: false })
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    const dayCount = Number(days)
    if (!name.trim() || !startDate || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 90) {
      setError('מלאו שם, תאריך התחלה ומספר ימים (1-90)')
      return
    }
    setBusy(true)
    setError(null)
    try {
      activate(await getBackend().createTrip(user, { name: name.trim(), startDate, days: dayCount }))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const join = async (event: FormEvent) => {
    event.preventDefault()
    if (normalizeInviteCode(code).length < 6) {
      setError('הקלידו את קוד ההזמנה שקיבלתם')
      return
    }
    setBusy(true)
    setError(null)
    try {
      activate(await getBackend().joinTrip(user, code))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AmbientBackground />
      <main className="pt-screen relative mx-auto w-full max-w-sm px-5 pb-10">
        <div className="flex items-center justify-between">
          {hasTrips ? (
            <button
              type="button"
              onClick={() => useTripStore.setState({ creatingTrip: false })}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg"
            >
              <ArrowRight aria-hidden className="size-4" /> חזרה לטיול
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void getBackend().signOut()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
          >
            <LogOut aria-hidden className="size-4" /> יציאה
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex items-center gap-4">
          <BrandMark className="size-14" />
          <div>
            <h1 className="text-2xl font-bold">היי {user.username}!</h1>
            <p className="text-sm text-muted">{hasTrips ? 'טיול נוסף?' : 'בואו נתחיל לתכנן'}</p>
          </div>
        </motion.div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {(
            [
              ['create', 'טיול חדש', Sparkles],
              ['join', 'הצטרפות עם קוד', Ticket],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value)
                setError(null)
              }}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-control py-3 text-sm font-semibold transition',
                tab === value ? 'bg-accent-fill text-accent-fg shadow-lg' : 'glass text-fg',
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mt-4 rounded-card p-5">
          {tab === 'create' ? (
            <form onSubmit={create} className="space-y-4" noValidate>
              <TextField label="שם הטיול" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <TextField
                  label="יום ראשון ביפן"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
                <TextField
                  label="ימים"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  dir="ltr"
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                יצירת הטיול
              </Button>
            </form>
          ) : (
            <form onSubmit={join} className="space-y-4" noValidate>
              <TextField
                label="קוד הזמנה"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="למשל K7Q2M9XD"
                hint="את הקוד מוצאים במסך הפרופיל של מי שיצר את הטיול"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                className="text-center font-mono text-lg tracking-[0.3em]"
                maxLength={12}
              />
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                הצטרפות לטיול
              </Button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  )
}
