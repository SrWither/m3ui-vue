// Internal: walking along a route (a path of [lng, lat] points) for MMapRoute — distances in meters, on the same sphere
// as _mapGeometry.ts

import { distance, type LngLat } from './_mapGeometry'

const RAD = Math.PI / 180

/** Distance from the start to each point of the path, in meters (`[0, …, total]`). */
export function cumulative(path: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push(out[i - 1]! + distance(path[i - 1]!, path[i]!))
  return out
}

/** Initial bearing from a to b, degrees clockwise from north (0–360). */
export function bearing(a: LngLat, b: LngLat): number {
  const φ1 = a[1] * RAD
  const φ2 = b[1] * RAD
  const Δλ = (b[0] - a[0]) * RAD
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) / RAD) + 360) % 360
}

/** The segment holding distance `d` (index of its first point). */
function segmentAt(cum: number[], d: number): number {
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= d) lo = mid
    else hi = mid
  }
  return lo
}

/** The point `d` meters along the path, and the heading there. Clamped to the path's ends. */
export function pointAlong(path: LngLat[], cum: number[], d: number): { lngLat: LngLat; bearing: number } {
  if (path.length === 0) return { lngLat: [0, 0], bearing: 0 }
  if (path.length === 1) return { lngLat: path[0]!, bearing: 0 }
  const total = cum[cum.length - 1]!
  const at = Math.min(Math.max(d, 0), total)
  const i = Math.min(segmentAt(cum, at), path.length - 2)
  const a = path[i]!
  const b = path[i + 1]!
  const len = cum[i + 1]! - cum[i]!
  const t = len > 0 ? (at - cum[i]!) / len : 0
  return { lngLat: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: headingFrom(path, cum, i) }
}

/** The heading of segment i, or of the nearest one with some length (routing output repeats points) */
function headingFrom(path: LngLat[], cum: number[], i: number): number {
  for (let j = i; j < path.length - 1; j++) if (cum[j + 1]! > cum[j]!) return bearing(path[j]!, path[j + 1]!)
  for (let j = i - 1; j >= 0; j--) if (cum[j + 1]! > cum[j]!) return bearing(path[j]!, path[j + 1]!)
  return 0
}

/** The part of the path between two distances along it. */
export function slicePath(path: LngLat[], cum: number[], from: number, to: number): LngLat[] {
  if (path.length < 2) return [...path]
  const total = cum[cum.length - 1]!
  const start = Math.min(Math.max(from, 0), total)
  const end = Math.min(Math.max(to, start), total)
  const out: LngLat[] = [pointAlong(path, cum, start).lngLat]
  for (let i = 0; i < path.length; i++) if (cum[i]! > start && cum[i]! < end) out.push(path[i]!)
  out.push(pointAlong(path, cum, end).lngLat)
  return out
}

/**
 * How far along the path (meters) the point nearest to `p` is: where a GPS position, slightly off the road, falls on
 * the route. Projects onto each segment in a local flat approximation (fine at street scale).
 */
export function project(path: LngLat[], cum: number[], p: LngLat): number {
  if (path.length < 2) return 0
  const k = Math.cos(p[1] * RAD)
  let best = Infinity
  let along = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
    const qx = ax + dx * t - px
    const qy = ay + dy * t - py
    const d2 = qx * qx + qy * qy
    if (d2 < best) {
      best = d2
      along = cum[i]! + (cum[i + 1]! - cum[i]!) * t
    }
  }
  return along
}

/**
 * Like `project`, but for something that moves forward along the route (a vehicle's GPS fixes, the stops in order):
 * only the part from `from` on is considered (minus `back` meters of slack for jitter), and points further ahead
 * cost a little more, so a route that passes the same place twice (out and back on one avenue, a loop, two close
 * parallel streets) doesn't snap a fix to the wrong pass. Never returns less than `from`.
 */
export function projectForward(path: LngLat[], cum: number[], p: LngLat, from: number, back = 25): number {
  if (path.length < 2) return 0
  const M = 111_320 // meters per degree of latitude
  const k = Math.cos(p[1] * RAD)
  const total = cum[cum.length - 1]!
  if (from >= total) return total
  let best = Infinity
  let along = from
  for (let i = 0; i < path.length - 1; i++) {
    if (cum[i + 1]! < from - back) continue
    const a = path[i]!
    const b = path[i + 1]!
    const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
    const off = Math.hypot(ax + dx * t - px, ay + dy * t - py) * M
    const d = cum[i]! + (cum[i + 1]! - cum[i]!) * t
    // A kilometer ahead costs as much as being 50 m off the road
    const cost = off + 0.05 * Math.max(0, d - from)
    if (cost < best) {
      best = cost
      along = d
    }
  }
  return Math.max(along, from)
}

/** The bounding box of points, `[[west, south], [east, north]]`. */
export function bounds(points: LngLat[]): [LngLat, LngLat] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [lng, lat] of points) {
    w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat)
  }
  return [[w, s], [e, n]]
}
