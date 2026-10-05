/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Maps Platform browser key (Maps JavaScript API + Places API (New)). */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Map ID from Google Cloud console. Required for Advanced Markers & cloud map styling. */
  readonly VITE_GOOGLE_MAP_ID?: string

  /** Firebase web app config (Project settings → Your apps). Not secret, but kept out of git. */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
