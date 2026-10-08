import type { Bounds, CategoryId, LatLng } from '@/data/types'
import type { GeoFix } from '@/hooks/useGeolocation'
import type { CameraCommand } from '@/store/ui'

export interface MapMarker {
  id: string
  /** saved = our places (filled pins); suggested = recommendations (outline pins). */
  kind: 'saved' | 'suggested'
  name: string
  category: CategoryId
  location: LatLng
  selected: boolean
  /** Stop number on a day route: the pin shows the number and its name. */
  order?: number
  /** A trip member's live position (shown as their initial). */
  member?: { name: string; color: string; ago: string }
}

export interface Viewport {
  bounds: Bounds
  center: LatLng
  /** Google zoom scale (MapLibre values are converted). */
  zoom: number
  bearing: number
}

/** What was tapped on the base map: a Google POI icon, a vector-tile POI, or nothing. */
export interface MapPoiClick {
  googlePlaceId?: string
  name?: string
  category?: CategoryId
}

/** Contract shared by the Google Maps and MapLibre (OpenStreetMap) engines. */
export interface MapViewProps {
  markers: MapMarker[]
  /** A day route, drawn as a line through these points in order. */
  path?: LatLng[]
  user: GeoFix | null
  camera: CameraCommand | null
  initialCenter: LatLng
  initialZoom: number
  onMarkerClick: (marker: MapMarker) => void
  onMapClick: (location: LatLng, poi: MapPoiClick | null) => void
  onLongPress: (location: LatLng) => void
  onViewportChange: (viewport: Viewport) => void
  /** The user started panning: used to stop "follow my location". */
  onUserGesture: () => void
}
