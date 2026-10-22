// MapLibre needs WebGL, which happy-dom lacks: a stand-in that records what the map components ask of it
type Listener = (e?: unknown) => void
class Evented {
  listeners = new Map<string, Listener[]>()
  on(type: string, a: unknown, b?: unknown) {
    const key = typeof a === 'string' ? `${type}:${a}` : type
    const fn = (typeof a === 'string' ? b : a) as Listener
    this.listeners.set(key, [...(this.listeners.get(key) ?? []), fn])
    return this
  }
  once(type: string, fn: Listener) { return this.on(type, fn) }
  off(type: string, a: unknown, b?: unknown) {
    const key = typeof a === 'string' ? `${type}:${a}` : type
    const fn = typeof a === 'string' ? b : a
    this.listeners.set(key, (this.listeners.get(key) ?? []).filter((l) => l !== fn))
    return this
  }
  fire(key: string, e?: unknown) { for (const l of this.listeners.get(key) ?? []) l(e) }
  count(key: string) { return (this.listeners.get(key) ?? []).length }
}

export const created: { maps: FakeMap[]; markers: FakeMarker[]; popups: FakePopup[] } = { maps: [], markers: [], popups: [] }

export class FakeMap extends Evented {
  options: Record<string, unknown>
  center = { lng: 0, lat: 0 }
  zoom = 1
  bearing = 0
  pitch = 0
  controls: { control: { onAdd?: (m: unknown) => HTMLElement }; position: string }[] = []
  sources = new Map<string, { data: unknown; setData: (d: unknown) => void }>()
  layers: { id: string; [k: string]: unknown }[] = []
  canvas = document.createElement('canvas')
  styles: unknown[] = []
  removed = false
  constructor(options: Record<string, unknown>) {
    super()
    this.options = options
    if (options.center) { const [lng, lat] = options.center as number[]; this.center = { lng: lng!, lat: lat! } }
    if (options.zoom !== undefined) this.zoom = options.zoom as number
    created.maps.push(this)
  }
  getCenter() { return this.center }
  getZoom() { return this.zoom }
  getBearing() { return this.bearing }
  getPitch() { return this.pitch }
  jumpTo(o: { center?: number[]; zoom?: number }) {
    if (o.center) this.center = { lng: o.center[0]!, lat: o.center[1]! }
    if (o.zoom !== undefined) this.zoom = o.zoom
  }
  addControl(control: FakeMap['controls'][number]['control'], position: string) {
    this.controls.push({ control, position })
    const el = control.onAdd?.(this)
    if (el) document.body.appendChild(el)
    return this
  }
  removeControl(control: unknown) { this.controls = this.controls.filter((c) => c.control !== control); return this }
  hasControl(control: unknown) { return this.controls.some((c) => c.control === control) }
  styleOptions: { transformStyle?: (previous: unknown, next: unknown) => unknown }[] = []
  setStyle(style: unknown, options: FakeMap['styleOptions'][number] = {}) {
    this.styles.push(style)
    this.styleOptions.push(options)
    this.sources.clear()
    this.layers = []
  }
  addSource(id: string, spec: { data: unknown }) {
    const source = { data: spec.data, setData: (d: unknown) => { source.data = d } }
    this.sources.set(id, source)
  }
  getSource(id: string) {
    if (this.removed) throw new TypeError("can't access property \"getSource\", this.style is undefined")
    return this.sources.get(id)
  }
  removeSource(id: string) { this.sources.delete(id) }
  addLayer(layer: { id: string }, before?: string) { this.layers.push({ ...layer, before }) }
  getLayer(id: string) {
    // Like MapLibre: a removed map has no style left
    if (this.removed) throw new TypeError("can't access property \"getLayer\", this.style is undefined")
    return this.layers.find((l) => l.id === id) ?? this.styleLayer(id)
  }
  removeLayer(id: string) { this.layers = this.layers.filter((l) => l.id !== id) }
  getCanvas() { return this.canvas }
  container = document.createElement('div')
  getContainer() { return this.container }
  /** The style getStyle() returns (with `layers` and `metadata`), set by tests */
  style: { name?: string; metadata?: unknown; layers: { id: string; type: string; metadata?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> }[] } = { layers: [] }
  getStyle() { return this.style }
  private styleLayer(id: string) { return this.style.layers.find((l) => l.id === id) }
  getLayoutProperty(id: string, prop: string) { return this.styleLayer(id)?.layout?.[prop] }
  setLayoutProperty(id: string, prop: string, value: unknown) { const l = this.styleLayer(id); if (l) l.layout = { ...l.layout, [prop]: value } }
  getPaintProperty(id: string, prop: string) { return this.styleLayer(id)?.paint?.[prop] }
  setPaintProperty(id: string, prop: string, value: unknown) { const l = this.styleLayer(id); if (l) l.paint = { ...l.paint, [prop]: value } }
  // Screen position: 1px per 0.001° (enough to tell near from far)
  project([lng, lat]: number[]) { return { x: lng! * 1000, y: -lat! * 1000 } }
  doubleClickZoom = { enabled: true, enable() { this.enabled = true }, disable() { this.enabled = false } }
  dragPan = { enabled: true, enable() { this.enabled = true }, disable() { this.enabled = false } }
  filters = new Map<string, unknown>()
  getFilter(id: string) { return this.filters.get(id) ?? (this.styleLayer(id) as { filter?: unknown } | undefined)?.filter }
  setFilter(id: string, filter: unknown) { this.filters.set(id, filter) }
  /** A source's loaded features, set by tests */
  sourceFeatures: { properties: Record<string, unknown> }[] = []
  querySourceFeatures() { return this.sourceFeatures }
  flights: unknown[] = []
  flyTo(o: unknown) { this.flights.push(['flyTo', o]) }
  fitBounds(b: unknown, o?: unknown) { this.flights.push(['fitBounds', b, o]) }
  /** Features "under the pointer", set by tests */
  rendered: { layer: { id: string }; properties: Record<string, unknown> }[] = []
  queryRenderedFeatures(_point: unknown, options?: { layers?: string[] }) { return this.rendered.filter((f) => !options?.layers || options.layers.includes(f.layer.id)) }
  remove() { this.removed = true }
  /** Test helper: the style loaded */
  load() { this.fire('style.load'); this.fire('load') }
}

export class FakeMarker extends Evented {
  options: Record<string, unknown>
  element: HTMLElement
  lngLat = { lng: 0, lat: 0 }
  popup?: FakePopup
  map?: FakeMap
  constructor(options: Record<string, unknown>) {
    super()
    this.options = options
    this.element = (options.element as HTMLElement) ?? document.createElement('div')
    created.markers.push(this)
  }
  setLngLat([lng, lat]: number[]) { this.lngLat = { lng: lng!, lat: lat! }; return this }
  getLngLat() { return this.lngLat }
  addTo(map: FakeMap) { this.map = map; return this }
  getElement() { return this.element }
  setPopup(p: FakePopup) { this.popup = p; return this }
  getPopup() { return this.popup }
  setDraggable() { return this }
  setRotation() { return this }
  setOffset() { return this }
  remove() { this.map = undefined; return this }
}

export class FakePopup extends Evented {
  options: Record<string, unknown>
  content?: HTMLElement
  lngLat?: { lng: number; lat: number }
  opened = false
  constructor(options: Record<string, unknown>) { super(); this.options = options; created.popups.push(this) }
  setDOMContent(el: HTMLElement) { this.content = el; return this }
  setLngLat([lng, lat]: number[]) { this.lngLat = { lng: lng!, lat: lat! }; return this }
  setMaxWidth() { return this }
  addTo() { this.opened = true; return this }
  isOpen() { return this.opened }
  remove() { if (this.opened) { this.opened = false; this.fire('close') } return this }
  setOffset(o: unknown) { this.options.offset = o; return this }
}

class Control { constructor(public options?: unknown) {} }
export const fakeModule = {
  Map: FakeMap,
  Marker: FakeMarker,
  Popup: FakePopup,
  NavigationControl: class NavigationControl extends Control {},
  GeolocateControl: class GeolocateControl extends Control {},
  FullscreenControl: class FullscreenControl extends Control {},
  ScaleControl: class ScaleControl extends Control {},
  AttributionControl: class AttributionControl extends Control {},
}
