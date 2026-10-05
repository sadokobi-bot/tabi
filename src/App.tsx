import { useEffect, type ReactNode } from 'react'
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
import { startSession, useSession } from '@/store/session'
import { useActiveTrip, useTripStore } from '@/store/trip'

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
  if (status === 'error') return <SplashScreen message="לא הצלחנו לטעון את האפליקציה. בדקו את החיבור ונסו לרענן." />
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
  const trip = useActiveTrip()

  if (!tripsLoaded) return <SplashScreen message={syncError ?? undefined} />
  if (!trip || creatingTrip) return <OnboardingScreen />
  if (!dataLoaded) return <SplashScreen message={syncError ?? undefined} />

  return (
    <MapsProvider>
      <AppLayout />
    </MapsProvider>
  )
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
