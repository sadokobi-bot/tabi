import type { DayPlan, Place, Trip } from '@/data/types'

export type Unsubscribe = () => void

export interface SessionUser {
  uid: string
  /** Username as the user typed it at sign-up (display form). */
  username: string
}

export type ErrorCode =
  | 'invalid-username'
  | 'username-taken'
  | 'invalid-credentials'
  | 'weak-password'
  | 'too-many-requests'
  | 'invite-not-found'
  | 'permission-denied'
  | 'network'
  | 'unknown'

export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'AppError'
  }
}

const MESSAGES: Record<ErrorCode, string> = {
  'invalid-username': 'שם המשתמש לא תקין',
  'username-taken': 'שם המשתמש הזה כבר תפוס. נסו שם אחר, או התחברו אם זה החשבון שלכם',
  'invalid-credentials': 'שם משתמש או סיסמה שגויים',
  'weak-password': 'הסיסמה צריכה לכלול לפחות 6 תווים',
  'too-many-requests': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות',
  'invite-not-found': 'לא מצאנו טיול עם הקוד הזה',
  'permission-denied': 'אין לכם הרשאה לפעולה הזו',
  network: 'אין חיבור לאינטרנט. נסו שוב',
  unknown: 'משהו השתבש. נסו שוב',
}

/** Hebrew, user-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message !== error.code ? error.message : MESSAGES[error.code]
  return MESSAGES.unknown
}

export interface NewTripInput {
  name: string
  startDate: string
  days: number
}

/** Optional starter content written together with a new trip. */
export interface TripSeed {
  places: Place[]
  plan: DayPlan
  dayCities: Record<string, string>
}

export type TripPatch = Partial<Pick<Trip, 'name' | 'startDate' | 'days' | 'flights'>>

/**
 * Everything the UI needs from persistence. Two implementations:
 * - `local`: accounts + data in this browser (works with zero setup, no sync between devices)
 * - `cloud`: Firebase Auth + Firestore (shared trips, real-time sync, offline cache)
 */
export interface Backend {
  readonly mode: 'local' | 'cloud'

  onAuthChange(callback: (user: SessionUser | null) => void): Unsubscribe
  signIn(username: string, password: string): Promise<void>
  signUp(username: string, password: string): Promise<void>
  signOut(): Promise<void>

  watchTrips(uid: string, callback: (trips: Trip[]) => void, onError: (error: AppError) => void): Unsubscribe
  createTrip(user: SessionUser, input: NewTripInput, seed?: TripSeed): Promise<string>
  joinTrip(user: SessionUser, inviteCode: string): Promise<string>
  updateTrip(tripId: string, patch: TripPatch): Promise<void>
  setDayCity(tripId: string, date: string, cityId: string | null): Promise<void>

  watchPlaces(tripId: string, callback: (places: Place[]) => void, onError: (error: AppError) => void): Unsubscribe
  savePlace(tripId: string, place: Place): Promise<void>
  /** Deletes a place and applies `planChanges` (the days that referenced it) in one atomic write. */
  deletePlace(tripId: string, placeId: string, planChanges: DayPlan): Promise<void>

  watchPlan(tripId: string, callback: (plan: DayPlan) => void, onError: (error: AppError) => void): Unsubscribe
  /** Replaces the item lists of the given dates; other dates are untouched. */
  updatePlan(tripId: string, changes: DayPlan): Promise<void>
}
