import { useEffect, useState, type ReactNode } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { MotionConfig } from 'motion/react'
import { BrowserRouter } from 'react-router'
import { TripDataSync } from '@/app/TripDataSync'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { Toaster } from '@/components/ui/Toaster'
import { GOOGLE_MAPS_API_KEY, hasGoogleMaps } from '@/config/env'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthScreen } from '@/screens/AuthScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { isoDateInTz } from '@/lib/dates'
import { getBackend, startSession, useCurrentUser, useSession } from '@/store/session'
import { rememberActiveTrip, useActiveTrip, useTripStore } from '@/store/trip'

// GitHub Pages serves the app from /<repo>/; Vite exposes that base path here.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  useEffect(() => startSession(), [])

  return (
    <BrowserRouter basename={basename}>
      {/* Honour the OS "reduce motion" setting across every animation in the app */}
      <MotionConfig reducedMotion="user">
        <SessionGate />
        <Toaster />
      </MotionConfig>
    </BrowserRouter>
  )
}

/** Auth → trip selection → app. */
function SessionGate() {
  const status = useSession((state) => state.status)

  if (status === 'loading') return <SplashScreen />
  if (status === 'error') return <SplashScreen failed message="לא הצלחנו לטעון את האפליקציה. בדקו את החיבור ונסו לרענן." />
  if (status === 'signedOut') return <AuthScreen />
  return (
    <>
      <TripDataSync />
      <SignedInApp />
    </>
  )
}

function SignedInApp() {
  const tripsLoaded = useTripStore((state) => state.tripsLoaded)
  const dataLoaded = useTripStore((state) => state.placesLoaded && state.planLoaded)
  const creatingTrip = useTripStore((state) => state.creatingTrip)
  const syncError = useTripStore((state) => state.syncError)
  const needsFirstTrip = useTripStore(
    (state) => state.tripsLoaded && state.tripsConfirmed && !state.syncError && state.trips.length === 0,
  )
  const trip = useActiveTrip()
  const firstTripFailed = useFirstTrip(needsFirstTrip)

  if (!tripsLoaded) return <SplashScreen failed={!!syncError} message={syncError ?? undefined} />
  // New trips are otherwise created from the trip settings ("הטיולים שלי"); this is only a fallback.
  if (creatingTrip || (!trip && firstTripFailed)) return <OnboardingScreen />
  if (!trip) return <SplashScreen failed={!!syncError} message={syncError ?? 'מכינים את הטיול שלכם…'} />
  if (!dataLoaded) return <SplashScreen failed={!!syncError} message={syncError ?? undefined} />

  return (
    <MapsProvider>
      <AppLayout />
    </MapsProvider>
  )
}

/** Users whose first trip is already being created (survives re-renders and StrictMode double effects). */
const firstTripStarted = new Set<string>()

/**
 * A new account goes straight into the app: its first trip is created automatically
 * (name, dates and length are editable in the trip settings). Returns true if that failed.
 */
function useFirstTrip(needed: boolean): boolean {
  const user = useCurrentUser()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!needed || failed || !user.uid || firstTripStarted.has(user.uid)) return
    firstTripStarted.add(user.uid)
    const input = { name: `יפן ${new Date().getFullYear()}`, startDate: isoDateInTz(new Date()), days: 30 }
    getBackend()
      .createTrip(user, input)
      .then(
        (tripId) => {
          rememberActiveTrip(user.uid, tripId)
          useTripStore.setState({ activeTripId: tripId })
        },
        (error: unknown) => {
          console.error('[trip] first trip could not be created', error)
          firstTripStarted.delete(user.uid)
          setFailed(true)
        },
      )
  }, [needed, failed, user])

  return failed
}

/** Loads the Google Maps JS API only when a key is configured (otherwise the free map is used). */
function MapsProvider({ children }: { children: ReactNode }) {
  if (!hasGoogleMaps) return children
  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      language="he"
      region="JP"
      onError={(error) => console.error('[google-maps] failed to load', error)}
    >
      {children}
    </APIProvider>
  )
}
