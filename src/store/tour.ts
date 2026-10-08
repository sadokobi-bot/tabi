import { create } from 'zustand'

/**
 * The welcome tour: owed to new accounts (set when they reach the first-trip screen), shown once
 * when the app opens, and replayable from the profile.
 */
const key = (uid: string) => `tabi:tour:${uid}`

export const useTour = create<{ open: boolean }>(() => ({ open: false }))

export function markTourPending(uid: string) {
  try {
    if (!localStorage.getItem(key(uid))) localStorage.setItem(key(uid), 'pending')
  } catch {
    // Storage unavailable: no tour, nothing breaks.
  }
}

export function tourPending(uid: string): boolean {
  try {
    return localStorage.getItem(key(uid)) === 'pending'
  } catch {
    return false
  }
}

export function startTour() {
  useTour.setState({ open: true })
}

export function finishTour(uid: string) {
  useTour.setState({ open: false })
  try {
    localStorage.setItem(key(uid), 'done')
  } catch {
    // Shown again next time; harmless.
  }
}
