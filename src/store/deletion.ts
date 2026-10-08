import { create } from 'zustand'
import { AppError, errorMessage, type DeletePhase } from '@/backend'
import type { Trip } from '@/data/types'
import { getBackend } from './session'

interface DeletionState {
  /** The trip being deleted (null: no deletion screen). */
  trip: { id: string; name: string } | null
  /** Phases finished so far, in order. */
  done: DeletePhase[]
  finished: boolean
  error: string | null
}

export const useDeletion = create<DeletionState>(() => ({ trip: null, done: [], finished: false, error: null }))

/**
 * Deletes a trip behind a full-screen "deleting…" screen. Runs outside the screens: the trip (and the
 * profile sheet it was started from) disappears from under it as it goes.
 */
export async function deleteTripWithProgress(trip: Trip) {
  useDeletion.setState({ trip: { id: trip.id, name: trip.name }, done: [], finished: false, error: null })
  try {
    await getBackend().deleteTrip(trip, (phase) => useDeletion.setState((state) => ({ done: [...state.done, phase] })))
    useDeletion.setState({ finished: true })
  } catch (error) {
    const denied = error instanceof AppError && error.code === 'permission-denied'
    useDeletion.setState({ error: denied ? 'אין הרשאה למחוק. ייתכן שההרשאות ב-Firebase עוד לא עודכנו' : errorMessage(error) })
  }
}

export function closeDeletion() {
  useDeletion.setState({ trip: null, done: [], finished: false, error: null })
}
