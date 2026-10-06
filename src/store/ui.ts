import { create } from 'zustand'
import type { CategoryId, LatLng } from '@/data/types'
import type { Poi } from '@/maps/poi'

/** Fields of a place that is about to be created (from the map, a search result or by hand). */
export interface PlaceDraft {
  name: string
  category: CategoryId
  location: LatLng
  address?: string
  googlePlaceId?: string
  osmId?: string
}

export type Selection =
  | { kind: 'place'; placeId: string }
  | { kind: 'poi'; poi: Poi }
  | { kind: 'draft'; draft: PlaceDraft }

/** Imperative camera request for whichever map engine is active. Zoom uses Google's scale. */
export interface CameraCommand {
  center?: LatLng
  zoom?: number
  bearing?: number
  nonce: number
}

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
}

interface UiState {
  selection: Selection | null
  camera: CameraCommand | null
  /** Map is in "move the map to choose a location" mode for a new place. */
  pickingLocation: boolean
  profileOpen: boolean
  toast: Toast | null
  /** The chat input is focused: the tab bar steps aside so the keyboard sits right under the input. */
  composing: boolean
  /** Open travel tool sheet (phrasebook, checklist, emergency), if any. */
  tool: ToolId | null
}

export type ToolId = 'phrases' | 'checklist' | 'emergency'

export const useUi = create<UiState>(() => ({
  selection: null,
  camera: null,
  pickingLocation: false,
  profileOpen: false,
  toast: null,
  composing: false,
  tool: null,
}))

let nonce = 0

export const ui = {
  openPlace: (placeId: string) => useUi.setState({ selection: { kind: 'place', placeId } }),
  openPoi: (poi: Poi) => useUi.setState({ selection: { kind: 'poi', poi } }),
  openDraft: (draft: PlaceDraft) => useUi.setState({ selection: { kind: 'draft', draft }, pickingLocation: false }),
  closeSheet: () => useUi.setState({ selection: null }),
  moveCamera: (command: Omit<CameraCommand, 'nonce'>) => useUi.setState({ camera: { ...command, nonce: ++nonce } }),
  setPicking: (pickingLocation: boolean) => useUi.setState({ pickingLocation, ...(pickingLocation ? { selection: null } : {}) }),
  setProfileOpen: (profileOpen: boolean) => useUi.setState({ profileOpen }),
  setComposing: (composing: boolean) => useUi.setState({ composing }),
  openTool: (tool: ToolId | null) => useUi.setState({ tool }),
  toast: (message: string, tone: Toast['tone'] = 'info') => useUi.setState({ toast: { id: ++nonce, message, tone } }),
}
