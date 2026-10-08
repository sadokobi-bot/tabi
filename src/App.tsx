import { useEffect, type ReactNode } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { MotionConfig } from 'motion/react'
import { BrowserRouter } from 'react-router'
import { TripDataSync } from '@/app/TripDataSync'
import { SplashScreen, useIntroDone } from '@/components/layout/SplashScreen'
import { Toaster } from '@/components/ui/Toaster'
import { DeletionScreen } from '@/components/profile/DeletionScreen'
import { GOOGLE_MAPS_API_KEY, hasGoogleMaps } from '@/config/env'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthScreen } from '@/screens/AuthScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { ProfileSetupScreen } from '@/screens/ProfileSetupScreen'
import { recallPendingJoin, rememberPendingJoin } from '@/store/joins'
import { ui } from '@/store/ui'
import { startSession, useSession } from '@/store/session'
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
        <DeletionScreen />
      </MotionConfig>
    </BrowserRouter>
  )
}

/** Auth → trip selection → app. */
function SessionGate() {
  const status = useSession((state) => state.status)
  const introDone = useIntroDone()

  if (status === 'loading') return <SplashScreen />
  if (status === 'error') return <SplashScreen failed message="לא הצלחנו לטעון את האפליקציה. בדקו את החיבור ונסו לרענן." />
  if (status === 'signedOut') return introDone ? <AuthScreen /> : <SplashScreen />
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
  const needsFirstTrip = useTripStore((state) => state.tripsLoaded && state.tripsConfirmed && !state.syncError && state.trips.length === 0)
  const trip = useActiveTrip()
  const introDone = useIntroDone()
  const profileMissing = useSession((state) => state.user?.profile === null)
  usePendingJoin()

  if (!tripsLoaded || !introDone) return <SplashScreen failed={!!syncError} message={syncError ?? undefined} />
  // Accounts from before sign-up asked for a name fill it in once (undefined = still loading: don't wait on it).
  if (profileMissing) return <ProfileSetupScreen />
  // A new account (no trips yet) chooses: a trip of its own, or joining one with an invite code.
  // Later trips are added from the trip settings ("הטיולים שלי"), which also lands here.
  if (creatingTrip || needsFirstTrip) return <OnboardingScreen />
  if (!trip) return <SplashScreen failed={!!syncError} message={syncError ?? 'מכינים את הטיול שלכם…'} />
  if (!dataLoaded) return <SplashScreen failed={!!syncError} message={syncError ?? undefined} />

  return (
    <MapsProvider>
      <AppLayout />
    </MapsProvider>
  )
}

/**
 * A join request this device sent was approved: the trip now shows up among the user's trips.
 * Open it, forget the request, and say welcome.
 */
function usePendingJoin() {
  const uid = useSession((state) => state.user?.uid)
  const trips = useTripStore((state) => state.trips)

  useEffect(() => {
    if (!uid) return
    const pending = recallPendingJoin(uid)
    const joined = pending && trips.find((trip) => trip.id === pending.tripId)
    if (!joined) return
    rememberPendingJoin(uid, null)
    rememberActiveTrip(uid, joined.id)
    useTripStore.setState({ activeTripId: joined.id, creatingTrip: false })
    ui.toast(`הבקשה אושרה! ברוכים הבאים ל״${joined.name}״`)
  }, [uid, trips])
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
