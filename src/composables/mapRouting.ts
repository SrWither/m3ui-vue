import type { LngLat } from './_mapGeometry'

/** A route between waypoints, as a routing service returns it. */
export interface MapRouteResult {
  /** The road to follow, `[lng, lat][]`: the streets' real shape (curves, roundabouts), one-way streets respected */
  path: LngLat[]
  /** Length in meters */
  distance: number
  /** Expected travel time in seconds */
  duration: number
}

/**
 * Where `MMapRoute` gets its road from when you give it `stops` but no `path`: any function from waypoints to a route.
 * `osrmRouteProvider()` ships; GraphHopper, Valhalla, OpenRouteService, Mapbox Directions or your own backend fit
 * the same shape. Gets an `AbortSignal`: a newer request cancels the older one.
 */
export type MapRouteProvider = (waypoints: LngLat[], options: { signal?: AbortSignal }) => Promise<MapRouteResult>

export interface OsrmRouteOptions {
  /**
   * The OSRM server. Defaults to the project's public demo server, which is meant for light use only (see its usage
   * policy): run your own (`osrm-backend` in Docker) or use a hosted one in production
   */
  url?: string
  /** The routing profile in the URL: `driving` (the demo server has only this one), `cycling`, `walking`, or your server's own */
  profile?: string
  /** More query parameters for OSRM (`exclude=toll`, `alternatives`…) */
  params?: Record<string, string>
}

/**
 * Routes through an OSRM server (Open Source Routing Machine, on OpenStreetMap data): the path follows the streets
 * as they are, and the car profile respects one-way streets and turn restrictions. Available from the `/map` entry
 * point.
 */
export function osrmRouteProvider(options: OsrmRouteOptions = {}): MapRouteProvider {
  const url = (options.url ?? 'https://router.project-osrm.org').replace(/\/$/, '')
  const profile = options.profile ?? 'driving'
  return async (waypoints, { signal }) => {
    if (waypoints.length < 2) return { path: [...waypoints], distance: 0, duration: 0 }
    const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';')
    const query = new URLSearchParams({ overview: 'full', geometries: 'geojson', ...options.params })
    const res = await fetch(`${url}/route/v1/${profile}/${coords}?${query}`, { signal })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = (await res.json()) as {
      code: string
      message?: string
      routes?: { geometry: { coordinates: LngLat[] }; distance: number; duration: number }[]
    }
    const route = data.routes?.[0]
    if (data.code !== 'Ok' || !route) throw new Error(`OSRM: ${data.message ?? data.code}`)
    return { path: route.geometry.coordinates, distance: route.distance, duration: route.duration }
  }
}
