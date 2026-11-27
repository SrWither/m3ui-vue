import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { created, type FakeMap } from './_fakeMaplibre'
import { bearing, bounds, cumulative, pointAlong, project, projectForward, slicePath } from '../composables/_routeGeometry'
import { roundabout, roundTrip, costanera, roundaboutMeta } from './_osrmRoutes'
import { pathLength } from '../composables/_mapGeometry'
import type { LngLat } from '../composables/_mapGeometry'

vi.mock('maplibre-gl', async () => (await import('./_fakeMaplibre')).fakeModule)

const { MMap, MMapRoute, osrmRouteProvider } = await import('../map')

beforeEach(() => {
  created.maps = []
  created.markers = []
  created.popups = []
  document.documentElement.style.setProperty('--color-primary', '#6750a4')
  document.documentElement.style.setProperty('--color-outline', '#79747e')
  document.documentElement.style.setProperty('--color-surface', '#fef7ff')
  // Reduced motion: moves jump, so tests don't wait for frames
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

// An L: 1 km-ish east, then north
const path: LngLat[] = [[-64.19, -31.42], [-64.18, -31.42], [-64.18, -31.41]]

describe('route geometry', () => {
  const cum = cumulative(path)

  it('accumulates distances and matches the path length', () => {
    expect(cum[0]).toBe(0)
    expect(cum[2]).toBeCloseTo(pathLength(path), 6)
  })

  it('walks along the path, with the heading of each leg', () => {
    const half = pointAlong(path, cum, cum[1]! / 2)
    expect(half.lngLat[0]).toBeCloseTo(-64.185, 6)
    expect(half.bearing).toBeCloseTo(90, 0) // east
    expect(pointAlong(path, cum, cum[1]! + 1).bearing).toBeCloseTo(0, 0) // north
    expect(pointAlong(path, cum, 1e9).lngLat).toEqual(path[2]) // clamped
  })

  it('slices the path between two distances, through its corners', () => {
    const part = slicePath(path, cum, cum[1]! / 2, cum[1]! + (cum[2]! - cum[1]!) / 2)
    expect(part).toHaveLength(3)
    expect(part[1]).toEqual(path[1])
  })

  it('projects an off-road point onto the route', () => {
    // A GPS fix a little north of the first leg's middle lands on it
    expect(project(path, cum, [-64.185, -31.4195])).toBeCloseTo(cum[1]! / 2, -1)
  })

  it('bearing and bounds', () => {
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(0, 6)
    expect(bearing([0, 0], [-1, 0])).toBeCloseTo(270, 6)
    expect(bounds(path)).toEqual([[-64.19, -31.42], [-64.18, -31.41]])
  })
})

async function mountRoute(props: Record<string, unknown>) {
  const p = ref(props)
  const wrapper = mount(() => h(MMap, { mapStyle: 's' }, () => h(MMapRoute, p.value)), { attachTo: document.body })
  await flushPromises()
  const map = created.maps.at(-1)! as FakeMap
  map.load()
  await nextTick()
  await nextTick()
  return { wrapper, map, p }
}

const routeData = (map: FakeMap) => {
  const source = [...map.sources.entries()].find(([id]) => id.startsWith('m3-route'))![1]
  return source.data as { features: { properties: { part: string }; geometry: { coordinates: LngLat[] } }[] }
}

describe('MMapRoute', () => {
  const stops = [{ lngLat: path[0]!, label: 'Restaurant' }, { lngLat: path[2]!, label: 'Home' }]

  it('draws the route, split into done and ahead, and fits the map to it', async () => {
    const { map } = await mountRoute({ stops, path, progress: 0.5 })
    expect(map.layers.map((l) => l.id).filter((id) => id.startsWith('m3-route'))).toHaveLength(3)
    const [rest, done] = routeData(map).features
    expect(rest!.properties.part).toBe('rest')
    expect(done!.geometry.coordinates[0]).toEqual(path[0])
    expect(rest!.geometry.coordinates.at(-1)).toEqual(path[2])
    expect(map.flights.some(([kind]) => kind === 'fitBounds')).toBe(true)
    // Ahead is the whole route, unchanging (its dots don't crawl); the exact shape, no simplification
    expect(rest!.geometry.coordinates).toEqual(path)
    expect((map.sources.get([...map.sources.keys()].find((id) => id.startsWith('m3-route'))!)!.spec as { tolerance?: number }).tolerance).toBe(0)
  })

  it('places the vehicle along the road, and a GPS position on the nearest point', async () => {
    const { map, p } = await mountRoute({ stops, path, progress: 0 })
    const vehicle = created.markers.find((m) => (m.getElement() as HTMLElement).classList?.contains('m3-map-route-vehicle'))!
    expect(vehicle.getLngLat()).toEqual({ lng: path[0]![0], lat: path[0]![1] })
    p.value = { stops, path, vehicle: [-64.18, -31.4152] } // off the road, near the second leg
    await nextTick()
    await flushPromises()
    expect(vehicle.getLngLat().lng).toBeCloseTo(-64.18, 6)
    expect(routeData(map).features[1]!.geometry.coordinates).toContainEqual(path[1])
  })

  it('marks the stops reached and emits arrive at the end', async () => {
    const onArrive = vi.fn()
    const { p, wrapper } = await mountRoute({ stops, path, progress: 0, onArrive })
    const stopEls = () => [...document.querySelectorAll('.m3-map-route-stop')]
    expect(stopEls()[0]!.classList.contains('bg-primary')).toBe(true) // the start is reached at 0
    expect(stopEls()[1]!.classList.contains('bg-primary')).toBe(false)
    p.value = { stops, path, progress: 1, onArrive }
    await nextTick()
    await flushPromises()
    expect(stopEls()[1]!.classList.contains('bg-primary')).toBe(true)
    expect(onArrive).toHaveBeenCalledTimes(1)
    expect(stopEls()[1]!.getAttribute('aria-label')).toBe('Home')
    wrapper.unmount()
  })

  it('without progress or vehicle there is no vehicle; straight lines when there is no path', async () => {
    const { map } = await mountRoute({ stops })
    expect(created.markers.find((m) => (m.getElement() as HTMLElement).classList?.contains('m3-map-route-vehicle'))?.map).toBeUndefined()
    expect(routeData(map).features[0]!.geometry.coordinates).toEqual([path[0], path[2]])
  })

  it('removes its layers and source on unmount', async () => {
    const { map, wrapper } = await mountRoute({ stops, path, progress: 0.3 })
    wrapper.unmount()
    expect(map.layers.some((l) => l.id.startsWith('m3-route'))).toBe(false)
    expect([...map.sources.keys()].some((id) => id.startsWith('m3-route'))).toBe(false)
  })
})

// ── Real streets (OSRM routes in Córdoba) ─────────────────────────────
const M = 111_320
const offRoad = (path: LngLat[], p: LngLat) => {
  // Distance (m) from p to the polyline, flat approximation
  const k = Math.cos((p[1] * Math.PI) / 180)
  let best = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = [path[i]![0] * k, path[i]![1]], [bx, by] = [path[i + 1]![0] * k, path[i + 1]![1]]
    const [dx, dy] = [bx - ax, by - ay]
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] * k - ax) * dx + (p[1] - ay) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(ax + dx * t - p[0] * k, ay + dy * t - p[1]) * M)
  }
  return best
}
/** A point of the return half that lies on the outbound half too (the stretch both ways share) */
function sharedPoint(path: LngLat[], cum: number[]) {
  const half = cum.at(-1)! / 2
  const outbound = slicePath(path, cum, 0, half * 0.9)
  for (let i = path.length - 1; i >= 0; i--) {
    if (cum[i]! > half * 1.1 && offRoad(outbound, path[i]!) < 3) return { point: path[i]!, at: cum[i]! }
  }
  throw new Error('no shared stretch')
}

describe('route geometry on real streets', () => {
  it('follows curves and roundabouts: every point along it is on the road, heading every way it turns', () => {
    const cum = cumulative(roundabout)
    expect(cum.at(-1)!).toBeCloseTo(roundaboutMeta.distance, -2) // our length ≈ OSRM's
    const headings: number[] = []
    for (let d = 0; d <= cum.at(-1)!; d += 15) {
      const { lngLat, bearing: b } = pointAlong(roundabout, cum, d)
      expect(offRoad(roundabout, lngLat)).toBeLessThan(0.5)
      headings.push(b)
    }
    // Diagonals and the roundabout: headings well away from the four grid directions
    expect(headings.some((b) => Math.min(...[0, 90, 180, 270, 360].map((g) => Math.abs(b - g))) > 25)).toBe(true)
    // Turning through the roundabout and the boulevard's curves: headings in at least 5 of the 8 compass sectors
    expect(new Set(headings.map((b) => Math.floor(b / 45) % 8)).size).toBeGreaterThanOrEqual(5)
    const curvy = cumulative(costanera)
    expect(slicePath(costanera, curvy, 0, curvy.at(-1)!)).toHaveLength(costanera.length)
  })

  it('keeps a heading over repeated points (routing output has them)', () => {
    const p: LngLat[] = [[0, 0], [0.001, 0], [0.001, 0], [0.002, 0]]
    const cum = cumulative(p)
    expect(pointAlong(p, cum, cum[1]!).bearing).toBeCloseTo(90, 3)
  })

  it('forward snapping: on the way back, a fix on the shared stretch stays on the way back', () => {
    const cum = cumulative(roundTrip)
    const { point, at } = sharedPoint(roundTrip, cum)
    expect(project(roundTrip, cum, point)).toBeLessThan(cum.at(-1)! / 2) // the plain nearest point is on the way out
    expect(projectForward(roundTrip, cum, point, at - 80)).toBeCloseTo(at, -1)
    // Never backwards, even with jitter behind it
    expect(projectForward(roundTrip, cum, roundTrip[0]!, at)).toBe(at)
  })
})

describe('MMapRoute on real streets', () => {
  const depot = roundTrip[0]!
  const drop = roundTrip[Math.floor(roundTrip.length / 2)]!
  const trip = [{ lngLat: depot, label: 'Depot' }, { lngLat: drop, label: 'Drop' }, { lngLat: depot, label: 'Back' }]
  const route = (w: ReturnType<typeof mount>) => w.findComponent(MMapRoute as never).vm as unknown as { travelled: number; length: number }
  const stopDone = (i: number) => document.querySelectorAll('.m3-map-route-stop')[i]!.classList.contains('bg-primary')

  it('a round trip: the last stop (where the first is) is reached at the end, not at the start', async () => {
    const { p } = await mountRoute({ stops: trip, path: roundTrip, progress: 0.1 })
    expect(stopDone(0)).toBe(true)
    expect(stopDone(2)).toBe(false)
    p.value = { stops: trip, path: roundTrip, progress: 1 }
    await nextTick()
    await flushPromises()
    expect(stopDone(2)).toBe(true)
  })

  it('a GPS fix on the shared stretch, on the way back, keeps the van on the way back (snap: forward)', async () => {
    const cum = cumulative(roundTrip)
    const { point, at } = sharedPoint(roundTrip, cum)
    const before = pointAlong(roundTrip, cum, at - 60).lngLat
    const { wrapper, p } = await mountRoute({ stops: trip, path: roundTrip, vehicle: before })
    p.value = { stops: trip, path: roundTrip, vehicle: [point[0] + 0.00005, point[1] + 0.00005] } // ~7 m off, as GPS is
    await nextTick()
    await flushPromises()
    expect(route(wrapper).travelled).toBeGreaterThan(cum.at(-1)! / 2)
  })

  it("snap: 'nearest' takes the closest point of the whole route", async () => {
    const cum = cumulative(roundTrip)
    const { point, at } = sharedPoint(roundTrip, cum)
    const { wrapper, p } = await mountRoute({ stops: trip, path: roundTrip, vehicle: pointAlong(roundTrip, cum, at - 60).lngLat, snap: 'nearest' })
    p.value = { stops: trip, path: roundTrip, vehicle: point, snap: 'nearest' }
    await nextTick()
    await flushPromises()
    expect(route(wrapper).travelled).toBeLessThan(cum.at(-1)! / 2)
  })

  it('provider: fetches the road between the stops, emits route, and redraws on it', async () => {
    const provider = vi.fn(async () => ({ path: roundabout, ...roundaboutMeta }))
    const onRoute = vi.fn()
    const stops = [{ lngLat: roundabout[0]! }, { lngLat: roundabout.at(-1)! }]
    const { map } = await mountRoute({ stops, provider, onRoute, progress: 0 })
    await flushPromises()
    expect(provider).toHaveBeenCalledWith([roundabout[0], roundabout.at(-1)], expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(onRoute).toHaveBeenCalledWith(expect.objectContaining({ distance: roundaboutMeta.distance }))
    expect(routeData(map).features[0]!.geometry.coordinates.length).toBeGreaterThan(100) // the streets, not a straight line
  })

  it('provider: a failure emits error and keeps straight lines; a newer request aborts the older one', async () => {
    const signals: AbortSignal[] = []
    const provider = vi.fn((_: LngLat[], { signal }: { signal?: AbortSignal }) => {
      signals.push(signal!)
      return Promise.reject(new Error('down'))
    })
    const onError = vi.fn()
    const stops = [{ lngLat: path[0]! }, { lngLat: path[2]! }]
    const { map, p } = await mountRoute({ stops, provider, onError })
    await flushPromises()
    expect(onError).toHaveBeenCalled()
    expect(routeData(map).features[0]!.geometry.coordinates).toEqual([path[0], path[2]])
    p.value = { stops: [stops[0]!, { lngLat: path[1]! }], provider, onError }
    await nextTick()
    expect(signals[0]!.aborted).toBe(true)
  })
})

describe('osrmRouteProvider', () => {
  it('asks OSRM for the full GeoJSON geometry and returns path, distance, duration', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: roundabout }, ...roundaboutMeta }] }) }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await osrmRouteProvider({ url: 'https://osrm.test/', params: { exclude: 'toll' } })([[-64.189, -31.4199], [-64.1752, -31.433]], {})
    const url = String((fetchMock.mock.calls[0] as unknown[])[0])
    expect(url).toBe('https://osrm.test/route/v1/driving/-64.189,-31.4199;-64.1752,-31.433?overview=full&geometries=geojson&exclude=toll')
    expect(result).toEqual({ path: roundabout, ...roundaboutMeta })
  })

  it('throws on an OSRM error (NoRoute…) or a bad status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ code: 'NoRoute', message: 'Impossible route' }) })))
    await expect(osrmRouteProvider()([[0, 0], [1, 1]], {})).rejects.toThrow('Impossible route')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })))
    await expect(osrmRouteProvider()([[0, 0], [1, 1]], {})).rejects.toThrow('429')
  })
})

describe('MMapRoute vehicle steadiness', () => {
  it("an icon heading south on a wobbly road doesn't flip back and forth; it turns around when clearly heading west", async () => {
    // South, wobbling a hair east and west (bearings around 180°, as a real road's short segments)
    const wobbly: LngLat[] = Array.from({ length: 12 }, (_, i) => [-64.18 + (i % 2 ? 0.000004 : -0.000004), -31.41 - i * 0.0005])
    const westward: LngLat[] = [...wobbly, [-64.19, -31.4155]]
    const stops = [{ lngLat: wobbly[0]! }, { lngLat: westward.at(-1)! }]
    const { p } = await mountRoute({ stops, path: westward, progress: 0, vehicleIcon: 'two_wheeler' })
    const icon = () => [...document.querySelectorAll('.m3-map-route-vehicle *')].find((e) => e.textContent?.trim() === 'two_wheeler' && !e.children.length) as HTMLElement
    const states: boolean[] = []
    const total = cumulative(westward).at(-1)!
    const southEnd = cumulative(wobbly).at(-1)! / total
    for (let k = 1; k <= 20; k++) {
      p.value = { stops, path: westward, progress: (k / 20) * southEnd * 0.95, vehicleIcon: 'two_wheeler' }
      await nextTick()
      await flushPromises()
      states.push(!!icon().style.transform)
    }
    expect(new Set(states).size).toBe(1) // never flipped on the way south
    p.value = { stops, path: westward, progress: 0.99, vehicleIcon: 'two_wheeler' }
    await nextTick()
    await flushPromises()
    expect(icon().style.transform).toBe('scaleX(-1)') // heading west at the end
  })

  it('positions the vehicle with subpixel precision', async () => {
    await mountRoute({ stops: [{ lngLat: path[0]! }, { lngLat: path[2]! }], path, progress: 0.3 })
    const vehicle = created.markers.find((m) => (m.getElement() as HTMLElement).classList?.contains('m3-map-route-vehicle'))!
    expect((vehicle as unknown as { options: Record<string, unknown> }).options.subpixelPositioning).toBe(true)
  })
})

describe('MMapRoute custom vehicle', () => {
  it('#vehicle gets { bearing, west }; rotateVehicle makes the marker turn it with the road', async () => {
    const scopes: { bearing: number; west: boolean }[] = []
    const p = ref<Record<string, unknown>>({ stops: [{ lngLat: path[0]! }, { lngLat: path[2]! }], path, progress: 0.25, rotateVehicle: true })
    mount(() => h(MMap, { mapStyle: 's' }, () => h(MMapRoute, p.value, {
      vehicle: (scope: { bearing: number; west: boolean }) => { scopes.push(scope); return h('img', { class: 'my-car', src: 'car.svg' }) },
    })), { attachTo: document.body })
    await flushPromises()
    const map = created.maps.at(-1)! as FakeMap
    map.load()
    await nextTick()
    await nextTick()
    expect(document.querySelector('.m3-map-route-vehicle .my-car')).not.toBeNull()
    const vehicle = created.markers.find((m) => (m.getElement() as HTMLElement).classList?.contains('m3-map-route-vehicle'))! as unknown as { options: Record<string, unknown>; rotation: number }
    expect(vehicle.options.rotationAlignment).toBe('map')
    expect(vehicle.rotation).toBeCloseTo(90, 0) // the first leg heads east
    expect(scopes.at(-1)).toEqual(expect.objectContaining({ west: false }))
  })
})

describe('MMapRoute flow', () => {
  it('the dots ahead stream toward the destination by shifting the dash pattern; the geometry stays put', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    let t = 0
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    // Runs every callback queued (other parts of the map may ask for frames too)
    const tick = (ms: number) => { t += ms; frames.splice(0).forEach((cb) => cb(t)) }
    const { map, p } = await mountRoute({ stops: [{ lngLat: path[0]! }, { lngLat: path[2]! }], path, progress: 0 })
    const paint = vi.spyOn(map, 'setPaintProperty')
    const data = routeData(map)
    const dashes = () => paint.mock.calls.filter(([id, prop]) => String(id).endsWith('-rest') && prop === 'line-dasharray').map((c) => c[2] as number[])
    tick(16)
    tick(60)
    tick(60)
    const seen = dashes()
    expect(seen.length).toBeGreaterThanOrEqual(2)
    // Each pattern covers one period (dot + gap), the dot a little further along each time
    for (const d of seen) expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(2.6, 6)
    expect(seen[1]![1]!).toBeGreaterThan(seen[0]![1]!)
    expect(routeData(map)).toBe(data) // no geometry re-sent for the flow
    // flow: false stops it, back to the unshifted pattern
    p.value = { stops: [{ lngLat: path[0]! }, { lngLat: path[2]! }], path, progress: 0, flow: false }
    await nextTick()
    expect(dashes().at(-1)).toEqual([0, 0, 1, 1.6])
  })

  it('pauses while the map is off screen', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    let report: (entries: { isIntersecting: boolean }[]) => void = () => {}
    vi.stubGlobal('IntersectionObserver', class { constructor(cb: typeof report) { report = cb } observe() {} disconnect() {} })
    let t = 0
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => { frames.length = 0 })
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    const tick = (ms: number) => { t += ms; frames.splice(0).forEach((cb) => cb(t)) }
    const { map } = await mountRoute({ stops: [{ lngLat: path[0]! }, { lngLat: path[2]! }], path, progress: 0 })
    const paint = vi.spyOn(map, 'setPaintProperty')
    report([{ isIntersecting: false }])
    paint.mockClear()
    tick(100)
    tick(100)
    expect(paint).not.toHaveBeenCalled()
    report([{ isIntersecting: true }])
    tick(16)
    tick(100)
    expect(paint).toHaveBeenCalled()
  })
})
