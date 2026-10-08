/** A join request this device sent and is waiting on (remembered across app restarts). */
export interface PendingJoin {
  tripId: string
  tripName?: string
  ownerName?: string
}

const key = (uid: string) => `tabi:pendingJoin:${uid}`

export function recallPendingJoin(uid: string): PendingJoin | null {
  try {
    const raw = localStorage.getItem(key(uid))
    return raw ? (JSON.parse(raw) as PendingJoin) : null
  } catch {
    return null
  }
}

export function rememberPendingJoin(uid: string, pending: PendingJoin | null) {
  try {
    if (pending) localStorage.setItem(key(uid), JSON.stringify(pending))
    else localStorage.removeItem(key(uid))
  } catch {
    // Private mode: the wait lasts for this session only.
  }
}
