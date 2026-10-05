import type { Bounds, LatLng } from '@/data/types'

const EARTH_RADIUS_M = 6_371_000

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function boundsCenter(bounds: Bounds): LatLng {
  return { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
}

/** Smallest circle (center + radius, meters) that covers the bounds. */
export function boundsToCircle(bounds: Bounds): { center: LatLng; radius: number } {
  const center = boundsCenter(bounds)
  return { center, radius: distanceMeters(center, { lat: bounds.north, lng: bounds.east }) }
}

export function isInBounds(point: LatLng, bounds: Bounds): boolean {
  return point.lat <= bounds.north && point.lat >= bounds.south && point.lng <= bounds.east && point.lng >= bounds.west
}

/** Coarse cache key for a viewport: ~1 km grid, so tiny pans reuse results. */
export function boundsKey(bounds: Bounds): string {
  const r = (n: number) => n.toFixed(2)
  return `${r(bounds.south)},${r(bounds.west)},${r(bounds.north)},${r(bounds.east)}`
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} מ׳`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} ק״מ`
}

/** Polygon ring approximating a circle, for GeoJSON accuracy rings. */
export function circlePolygon(center: LatLng, radiusM: number, steps = 48): [number, number][] {
  const coords: [number, number][] = []
  const latRad = (center.lat * Math.PI) / 180
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const dLat = (radiusM / EARTH_RADIUS_M) * Math.cos(angle)
    const dLng = (radiusM / (EARTH_RADIUS_M * Math.cos(latRad))) * Math.sin(angle)
    coords.push([center.lng + (dLng * 180) / Math.PI, center.lat + (dLat * 180) / Math.PI])
  }
  return coords
}
