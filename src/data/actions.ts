import { errorMessage, type TripPatch } from '@/backend'
import { newId } from '@/lib/ids'
import { getBackend, useSession } from '@/store/session'
import { setPlaces, useTripStore } from '@/store/trip'
import { ui, type PlaceDraft } from '@/store/ui'
import * as planOps from './planOps'
import type { DayPlan, Place } from './types'

/**
 * User actions. Writes run in the background: the store updates immediately (local mode)
 * or from Firestore's latency-compensated snapshot (cloud mode), so the UI never waits for
 * the network. Failures surface as a toast.
 */

function activeTripId(): string {
  const id = useTripStore.getState().activeTripId
  if (!id) throw new Error('No active trip')
  return id
}

function background(promise: Promise<unknown>, success?: string) {
  promise.then(
    () => {
      if (success) ui.toast(success)
    },
    (error: unknown) => ui.toast(errorMessage(error), 'error'),
  )
}

const plan = () => useTripStore.getState().plan

/** Optimistic local update; the backend snapshot that follows confirms (or reverts) it. */
function applyPlanLocally(changes: DayPlan) {
  useTripStore.setState((state) => ({ plan: { ...state.plan, ...changes } }))
}

function upsertPlaceLocally(place: Place) {
  const { places } = useTripStore.getState()
  setPlaces([...places.filter((other) => other.id !== place.id), place])
}

function writePlan(changes: DayPlan, success?: string) {
  if (Object.keys(changes).length === 0) return
  applyPlanLocally(changes)
  background(getBackend().updatePlan(activeTripId(), changes), success)
}

export interface PlaceFields extends PlaceDraft {
  notes?: string
  url?: string
  booking?: Place['booking']
  visit?: Place['visit']
}

export const actions = {
  /** `success`: the toast once saved; null stays quiet (e.g. when saving a batch). */
  createPlace(fields: PlaceFields, success: string | null = 'נשמר ברשימת המקומות'): Place {
    const now = Date.now()
    const uid = useSession.getState().user?.uid ?? 'unknown'
    const place: Place = { ...fields, id: newId(), createdBy: uid, createdAt: now, updatedAt: now }
    upsertPlaceLocally(place)
    background(getBackend().savePlace(activeTripId(), place), success ?? undefined)
    return place
  },

  updatePlace(place: Place, patch: Partial<PlaceFields>, success?: string) {
    const updated: Place = { ...place, ...patch, updatedAt: Date.now() }
    upsertPlaceLocally(updated)
    background(getBackend().savePlace(activeTripId(), updated), success)
  },

  deletePlace(placeId: string) {
    const changes = planOps.removePlaceEverywhere(plan(), placeId)
    const { places } = useTripStore.getState()
    setPlaces(places.filter((place) => place.id !== placeId))
    applyPlanLocally(changes)
    background(getBackend().deletePlace(activeTripId(), placeId, changes), 'המקום נמחק')
  },

  addToDay(placeId: string, date: string, time?: string, success?: string) {
    writePlan(planOps.addToDay(plan(), date, placeId, time), success)
  },

  removeFromDay(date: string, itemId: string) {
    writePlan(planOps.removeFromDay(plan(), date, itemId))
  },

  setItemTime(date: string, itemId: string, time: string | undefined) {
    writePlan(planOps.setItemTime(plan(), date, itemId, time))
  },

  /** Commits a drag & drop result (only the changed days). */
  applyPlanChanges(changes: DayPlan) {
    writePlan(changes)
  },

  setDayCity(date: string, cityId: string | null) {
    background(getBackend().setDayCity(activeTripId(), date, cityId))
  },

  setStay(date: string, placeId: string | null) {
    background(getBackend().setStay(activeTripId(), date, placeId))
  },

  updateTrip(patch: TripPatch, success?: string) {
    background(getBackend().updateTrip(activeTripId(), patch), success)
  },
}
