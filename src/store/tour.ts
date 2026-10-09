import { create } from 'zustand'

/**
 * The tours: "welcome" walks a new account through the app once (owed from the first-trip screen),
 * "map" explains the map the first time it's opened after that. Both are replayable from the profile.
 */
export type TourId = 'welcome' | 'map'

const key = (tour: TourId, uid: string) => (tour === 'welcome' ? `tabi:tour:${uid}` : `tabi:tour-${tour}:${uid}`)

function read(tour: TourId, uid: string): string | null {
  try {
    return localStorage.getItem(key(tour, uid))
  } catch {
    return null
  }
}

function write(tour: TourId, uid: string, value: string) {
  try {
    localStorage.setItem(key(tour, uid), value)
  } catch {
    // Storage unavailable: the tour may show again; harmless.
  }
}

export const useTour = create<{ open: TourId | null }>(() => ({ open: null }))

export function markTourPending(uid: string) {
  if (!read('welcome', uid)) write('welcome', uid, 'pending')
}

export function tourPending(uid: string): boolean {
  return read('welcome', uid) === 'pending'
}

/** The map tour, on the first visit to the map once the welcome tour is out of the way. */
export function mapTourDue(uid: string): boolean {
  return !tourPending(uid) && useTour.getState().open === null && read('map', uid) !== 'done'
}

export function startTour(tour: TourId = 'welcome') {
  useTour.setState({ open: tour })
}

export function finishTour(uid: string) {
  const tour = useTour.getState().open
  useTour.setState({ open: null })
  if (tour) write(tour, uid, 'done')
}
