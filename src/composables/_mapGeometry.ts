// Internal: the geodesy MMapMeasure needs, on a sphere of the Earth's mean radius (as @turf/length and @turf/area do,
// so the numbers match what the Orvian viewers measured with turf)

export type LngLat = [number, number]

const R = 6371008.8 // meters
const RAD = Math.PI / 180

/** Great-circle distance between two points, in meters (haversine). */
export function distance(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLng = (b[0] - a[0]) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The length of a path, in meters. */
export function pathLength(points: LngLat[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1]!, points[i]!)
  return total
}

/** The point halfway along the great circle between two points. */
export function midpoint(a: LngLat, b: LngLat): LngLat {
  const [l1, p1, l2, p2] = [a[0] * RAD, a[1] * RAD, b[0] * RAD, b[1] * RAD]
  const bx = Math.cos(p2) * Math.cos(l2 - l1)
  const by = Math.cos(p2) * Math.sin(l2 - l1)
  const lat = Math.atan2(Math.sin(p1) + Math.sin(p2), Math.sqrt((Math.cos(p1) + bx) ** 2 + by ** 2))
  const lng = l1 + Math.atan2(by, Math.cos(p1) + bx)
  return [lng / RAD, lat / RAD]
}

/** The area of a ring (closed or not), in square meters, on the sphere (@turf/area's formula). */
export function ringArea(points: LngLat[]): number {
  const ring = closeRing(points)
  const n = ring.length - 1
  if (n <= 2) return 0
  let total = 0
  for (let i = 0; i < n; i++) {
    const lower = ring[i]!
    const middle = ring[i + 1 === n ? 0 : i + 1]!
    const upper = ring[i + 2 >= n ? (i + 2) % n : i + 2]!
    total += (upper[0] - lower[0]) * RAD * Math.sin(middle[1] * RAD)
  }
  return Math.abs((total * R * R) / 2)
}

/** The ring with its first point repeated at the end. */
export function closeRing(points: LngLat[]): LngLat[] {
  const first = points[0]
  const last = points[points.length - 1]
  return first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...points, first] : points
}

/** Where to label a polygon: its area centroid (in degrees, fine at a measuring scale), or the vertices' mean. */
export function centroid(points: LngLat[]): LngLat {
  const ring = closeRing(points)
  let a = 0
  let x = 0
  let y = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!
    const [x1, y1] = ring[i + 1]!
    const f = x0 * y1 - x1 * y0
    a += f
    x += (x0 + x1) * f
    y += (y0 + y1) * f
  }
  if (Math.abs(a) < 1e-12) {
    const pts = ring.slice(0, -1)
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
  }
  return [x / (3 * a), y / (3 * a)]
}
