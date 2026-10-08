import { useEffect } from 'react'
import { AdvancedMarker, Circle, Map, useMap } from '@vis.gl/react-google-maps'
import { GOOGLE_MAP_ID } from '@/config/env'
import type { LatLng } from '@/data/types'
import type { CameraCommand } from '@/store/ui'
import { MarkerPin, MemberPin, UserDot } from './MarkerPin'
import type { MapViewProps } from './types'

/**
 * Google Maps engine (vector map: pan, zoom, rotate and tilt with gestures).
 * Tapping a Google POI icon opens our place sheet instead of Google's info window.
 */
export default function GoogleMapView({
  markers,
  path,
  user,
  camera,
  initialCenter,
  initialZoom,
  onMarkerClick,
  onMapClick,
  onLongPress,
  onViewportChange,
  onUserGesture,
}: MapViewProps) {
  return (
    <Map
      mapId={GOOGLE_MAP_ID}
      defaultCenter={initialCenter}
      defaultZoom={initialZoom}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons
      colorScheme="FOLLOW_SYSTEM"
      renderingType="VECTOR"
      headingInteractionEnabled
      tiltInteractionEnabled
      className="h-full w-full"
      onIdle={({ map }) => {
        const bounds = map.getBounds()?.toJSON()
        const center = map.getCenter()?.toJSON()
        if (!bounds || !center) return
        onViewportChange({ bounds, center, zoom: map.getZoom() ?? initialZoom, bearing: map.getHeading() ?? 0 })
      }}
      onDragstart={onUserGesture}
      onClick={(event) => {
        const { latLng, placeId } = event.detail
        if (!latLng) return
        if (placeId) {
          event.stop() // suppress Google's default info window
          onMapClick(latLng, { googlePlaceId: placeId })
        } else {
          onMapClick(latLng, null)
        }
      }}
      onContextmenu={(event) => {
        if (event.detail.latLng) onLongPress(event.detail.latLng)
      }}
    >
      {markers.map((marker) => (
        <AdvancedMarker
          key={marker.id}
          position={marker.location}
          title={marker.name}
          zIndex={marker.selected ? 900 : marker.member ? 800 : marker.order != null ? 600 : marker.kind === 'saved' ? 500 : 100}
          anchorLeft="-50%"
          anchorTop="-50%"
          onClick={() => onMarkerClick(marker)}
        >
          {marker.member ? (
            <MemberPin {...marker.member} />
          ) : (
            <MarkerPin
              category={marker.category}
              variant={marker.kind}
              selected={marker.selected}
              order={marker.order}
              emoji={marker.emoji}
              label={marker.selected || marker.order != null ? marker.name : undefined}
            />
          )}
        </AdvancedMarker>
      ))}

      {user && (
        <>
          <Circle
            center={user.location}
            radius={user.accuracy}
            clickable={false}
            fillColor="#2f7cf6"
            fillOpacity={0.12}
            strokeColor="#2f7cf6"
            strokeOpacity={0.35}
            strokeWeight={1}
          />
          <AdvancedMarker position={user.location} zIndex={1000} anchorLeft="-50%" anchorTop="-50%" clickable={false}>
            <UserDot />
          </AdvancedMarker>
        </>
      )}

      {path && path.length > 1 && <RouteLine path={path} />}
      <CameraSync camera={camera} />
    </Map>
  )
}

function CameraSync({ camera }: { camera: CameraCommand | null }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !camera) return
    if (camera.bounds) {
      map.fitBounds(camera.bounds, ROUTE_PADDING)
      // Two stops next door would otherwise zoom in to street level.
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 16) map.setZoom(16)
      })
      return
    }
    if (camera.center) map.panTo(camera.center)
    if (camera.zoom != null) map.setZoom(camera.zoom)
    if (camera.bearing != null) {
      map.setHeading(camera.bearing)
      map.setTilt(0)
    }
  }, [map, camera])

  return null
}

/** Room for the search bar above and the tab bar below when fitting a route. */
const ROUTE_PADDING = { top: 170, bottom: 110, left: 48, right: 48 }

/** The day route: a soft halo under a solid line in the accent color. */
function RouteLine({ path }: { path: LatLng[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--app-accent-fill').trim() || '#cc4329'
    const halo = new google.maps.Polyline({
      map,
      path,
      clickable: false,
      strokeColor: '#ffffff',
      strokeOpacity: 0.85,
      strokeWeight: 8,
      zIndex: 1,
    })
    const line = new google.maps.Polyline({
      map,
      path,
      clickable: false,
      strokeColor: accent,
      strokeOpacity: 0.95,
      strokeWeight: 4,
      zIndex: 2,
    })
    return () => {
      halo.setMap(null)
      line.setMap(null)
    }
  }, [map, path])

  return null
}
