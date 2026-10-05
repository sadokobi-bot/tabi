import { useEffect } from 'react'
import { AdvancedMarker, Circle, Map, useMap } from '@vis.gl/react-google-maps'
import { GOOGLE_MAP_ID } from '@/config/env'
import type { CameraCommand } from '@/store/ui'
import { MarkerPin, UserDot } from './MarkerPin'
import type { MapViewProps } from './types'

/**
 * Google Maps engine (vector map: pan, zoom, rotate and tilt with gestures).
 * Tapping a Google POI icon opens our place sheet instead of Google's info window.
 */
export default function GoogleMapView({
  markers,
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
          zIndex={marker.selected ? 900 : marker.kind === 'saved' ? 500 : 100}
          anchorLeft="-50%"
          anchorTop="-50%"
          onClick={() => onMarkerClick(marker)}
        >
          <MarkerPin
            category={marker.category}
            variant={marker.kind}
            selected={marker.selected}
            label={marker.selected ? marker.name : undefined}
          />
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

      <CameraSync camera={camera} />
    </Map>
  )
}

function CameraSync({ camera }: { camera: CameraCommand | null }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !camera) return
    if (camera.center) map.panTo(camera.center)
    if (camera.zoom != null) map.setZoom(camera.zoom)
    if (camera.bearing != null) {
      map.setHeading(camera.bearing)
      map.setTilt(0)
    }
  }, [map, camera])

  return null
}
