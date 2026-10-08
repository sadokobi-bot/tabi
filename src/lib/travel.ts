import type { LatLng } from '@/data/types'
import { distanceMeters } from './geo'

/**
 * Rough door-to-door travel estimates between two stops in a Japanese city.
 *
 * Google's routing APIs return no transit routes in Japan (rail data licensing), so instead of a
 * billed call that comes back empty we estimate from the straight-line distance and link to Google
 * Maps for the real connection. Calibrated on typical Tokyo / Kyoto / Osaka hops.
 */
export type LegMode = 'walk' | 'transit' | 'intercity'

export interface Leg {
  mode: LegMode
  minutes: number
  meters: number
}

/** Streets are not straight lines. */
const DETOUR = 1.3
/** ~4.8 km/h. */
const WALK_M_PER_MIN = 80
/** Above this a walk is unpleasant and a train usually wins. */
const MAX_WALK_MIN = 18

export function estimateLeg(from: LatLng, to: LatLng): Leg {
  const meters = distanceMeters(from, to)
  const walk = Math.max(1, Math.round((meters * DETOUR) / WALK_M_PER_MIN))
  if (walk <= MAX_WALK_MIN) return { mode: 'walk', minutes: walk, meters }

  if (meters > 80_000) {
    // Shinkansen / limited express: getting to the station and boarding, then ~180 km/h.
    return { mode: 'intercity', minutes: roundTo(30 + (meters * 1.15) / 3000, 10), meters }
  }
  // Walk to and from stations (~12 min), waiting and transfers (~5), then the ride: city lines
  // average ~30 km/h, longer suburban runs ~55 km/h.
  const ride = (meters * 1.25) / (meters < 15_000 ? 500 : 900)
  return { mode: 'transit', minutes: roundTo(17 + ride, 5), meters }
}

function roundTo(value: number, step: number) {
  return Math.max(step, Math.round(value / step) * step)
}

/** Total length of a path through the given points, in meters. */
export function pathMeters(points: LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1]!, points[i]!)
  return total
}

/**
 * Shortest open path through `points` (nearest neighbour, then 2-opt), as an index order.
 * With `fixedStart` the path must begin at that point (e.g. the hotel, or the last timed stop);
 * otherwise every point is tried as the start. Fine for a day's handful of stops.
 */
export function shortestPathOrder(points: LatLng[], fixedStart?: LatLng): number[] {
  const n = points.length
  if (n < 2) return points.map((_, i) => i)
  const nodes = fixedStart ? [fixedStart, ...points] : points
  const dist = nodes.map((a) => nodes.map((b) => distanceMeters(a, b)))
  const length = (order: number[]) => order.slice(1).reduce((sum, node, i) => sum + dist[order[i]!]![node]!, 0)

  const starts = fixedStart ? [0] : nodes.map((_, i) => i)
  let best: number[] = []
  let bestLength = Infinity
  for (const start of starts) {
    const order = twoOpt(nearestNeighbour(start, dist), dist, fixedStart != null)
    const total = length(order)
    if (total < bestLength) {
      best = order
      bestLength = total
    }
  }
  return fixedStart ? best.slice(1).map((node) => node - 1) : best
}

function nearestNeighbour(start: number, dist: number[][]): number[] {
  const order = [start]
  const left = new Set(dist.map((_, i) => i).filter((i) => i !== start))
  while (left.size) {
    const last = order[order.length - 1]!
    let next = -1
    for (const candidate of left) if (next === -1 || dist[last]![candidate]! < dist[last]![next]!) next = candidate
    order.push(next)
    left.delete(next)
  }
  return order
}

/** Reverses segments while that shortens the path; the first node stays put when `keepFirst`. */
function twoOpt(order: number[], dist: number[][], keepFirst: boolean): number[] {
  const route = [...order]
  const d = (a: number, b: number) => dist[route[a]!]![route[b]!]!
  let improved = true
  while (improved) {
    improved = false
    for (let i = keepFirst ? 1 : 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        // Open path: edges (i-1, i) and (j, j+1), either of which may not exist at the ends.
        const before = (i > 0 ? d(i - 1, i) : 0) + (j < route.length - 1 ? d(j, j + 1) : 0)
        const after = (i > 0 ? d(i - 1, j) : 0) + (j < route.length - 1 ? d(i, j + 1) : 0)
        if (after + 1 < before) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse())
          improved = true
        }
      }
    }
  }
  return route
}
