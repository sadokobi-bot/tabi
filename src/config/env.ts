/**
 * Runtime configuration resolved from Vite env vars (see .env.example).
 * Every integration is optional: without keys the app runs in a fully working local mode
 * (accounts + data in this browser, free OpenStreetMap map).
 */
const env = import.meta.env

const clean = (value: string | undefined) => value?.trim() ?? ''

/* ── Google Maps Platform ── */
export const GOOGLE_MAPS_API_KEY = clean(env.VITE_GOOGLE_MAPS_API_KEY)
/** Google's public demo Map ID works for Advanced Markers until you create your own. */
export const GOOGLE_MAP_ID = clean(env.VITE_GOOGLE_MAP_ID) || 'DEMO_MAP_ID'
export const hasGoogleMaps = GOOGLE_MAPS_API_KEY.length > 0

/* ── Firebase (accounts + shared cloud sync) ── */
/** reCAPTCHA v3 site key for Firebase App Check (public by design). Without it App Check is off. */
export const RECAPTCHA_SITE_KEY = clean(env.VITE_RECAPTCHA_SITE_KEY)

export const firebaseConfig = {
  apiKey: clean(env.VITE_FIREBASE_API_KEY),
  authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(env.VITE_FIREBASE_STORAGE_BUCKET) || undefined,
  messagingSenderId: clean(env.VITE_FIREBASE_MESSAGING_SENDER_ID) || undefined,
  appId: clean(env.VITE_FIREBASE_APP_ID),
}
export const hasFirebase = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)
