import { create } from 'zustand'
import type { Presence } from '@/data/types'

interface PresenceState {
  /** Members' live positions in the active trip, by uid (our own included). */
  byUid: Record<string, Presence>
  /** This device shares its position with the trip (opt-in, remembered per user and trip). */
  sharing: boolean
}

export const usePresence = create<PresenceState>(() => ({ byUid: {}, sharing: false }))

const sharingKey = (uid: string, tripId: string) => `tabi:shareLocation:${uid}:${tripId}`

export function recallSharing(uid: string, tripId: string): boolean {
  try {
    return localStorage.getItem(sharingKey(uid, tripId)) === '1'
  } catch {
    return false
  }
}

export function rememberSharing(uid: string, tripId: string, sharing: boolean) {
  usePresence.setState({ sharing })
  try {
    if (sharing) localStorage.setItem(sharingKey(uid, tripId), '1')
    else localStorage.removeItem(sharingKey(uid, tripId))
  } catch {
    // Private mode: the choice lasts for this session only.
  }
}

/** A shared position older than this is no longer shown as "here now". */
export const PRESENCE_FRESH_MS = 30 * 60_000
