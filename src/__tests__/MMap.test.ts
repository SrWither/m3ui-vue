import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

// MapLibre needs WebGL, which happy-dom lacks: a stand-in that records what the components ask of it
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

const created: { maps: FakeMap[]; markers: FakeMarker[]; popups: FakePopup[] } = { maps: [], markers: [], popups: [] }

class FakeMap extends Evented {
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
  setStyle(style: unknown) {
    this.styles.push(style)
    this.sources.clear()
    this.layers = []
  }
  addSource(id: string, spec: { data: unknown }) {
    const source = { data: spec.data, setData: (d: unknown) => { source.data = d } }
    this.sources.set(id, source)
  }
  getSource(id: string) { return this.sources.get(id) }
  removeSource(id: string) { this.sources.delete(id) }
  addLayer(layer: { id: string }, before?: string) { this.layers.push({ ...layer, before }) }
  getLayer(id: string) { return this.layers.find((l) => l.id === id) }
  removeLayer(id: string) { this.layers = this.layers.filter((l) => l.id !== id) }
  getCanvas() { return this.canvas }
  remove() { this.removed = true }
  /** Test helper: the style loaded */
  load() { this.fire('style.load'); this.fire('load') }
}

class FakeMarker extends Evented {
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

class FakePopup extends Evented {
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
}

class Control { constructor(public options?: unknown) {} }
vi.mock('maplibre-gl', () => ({
  Map: FakeMap,
  Marker: FakeMarker,
  Popup: FakePopup,
  NavigationControl: class NavigationControl extends Control {},
  GeolocateControl: class GeolocateControl extends Control {},
  FullscreenControl: class FullscreenControl extends Control {},
  ScaleControl: class ScaleControl extends Control {},
  AttributionControl: class AttributionControl extends Control {},
}))

const { MMap, MMapMarker, MMapPopup, MMapGeoJson, MMapControl, useMap } = await import('../map')

beforeEach(() => {
  created.maps = []
  created.markers = []
  created.popups = []
  localStorage.clear()
  document.documentElement.style.setProperty('--color-primary', '#6750a4')
  document.documentElement.style.setProperty('--color-surface', '#fef7ff')
})
afterEach(() => { document.body.innerHTML = '' })

/** Mounts an MMap, waits for MapLibre to "load" and the slot to render. */
async function mountMap(props: Record<string, unknown> = {}, slot?: () => unknown) {
  const wrapper = mount(MMap, { props: { mapStyle: 'https://tiles.test/style.json', ...props }, slots: slot ? { default: slot } : {}, attachTo: document.body })
  await flushPromises()
  const map = created.maps.at(-1)!
  map.load()
  await nextTick()
  await nextTick()
  return { wrapper, map }
}

const controlNames = (map: FakeMap) => map.controls.map((c) => `${(c.control.constructor as { name: string }).name}@${c.position}`)

describe('MMap', () => {
  it('creates the map with the style, the view, MapLibre strings from the locale and no default attribution', async () => {
    const { wrapper, map } = await mountMap({ center: [-64.29, -31.29], zoom: 13 })
    expect(map.options.style).toBe('https://tiles.test/style.json')
    expect(map.options.center).toEqual([-64.29, -31.29])
    expect(map.options.zoom).toBe(13)
    expect(map.options.attributionControl).toBe(false)
    expect((map.options.locale as Record<string, string>)['NavigationControl.ZoomIn']).toBe('Zoom in')
    expect(wrapper.emitted('ready')?.[0]?.[0]).toBe(map)
  })

  it('leaves the view to the style when none is given', async () => {
    const { map } = await mountMap()
    expect('center' in map.options).toBe(false)
    expect('zoom' in map.options).toBe(false)
  })

  it('adds the default controls at their corners, and follows the props', async () => {
    const { wrapper, map } = await mountMap()
    expect(controlNames(map)).toEqual(['NavigationControl@top-right', 'ScaleControl@bottom-left', 'AttributionControl@bottom-right'])
    await wrapper.setProps({ geolocate: true, navigation: 'top-left', scale: false })
    expect(controlNames(map).sort()).toEqual(['AttributionControl@bottom-right', 'GeolocateControl@top-right', 'NavigationControl@top-left'])
  })

  it('emits the view on moveend (v-model) and remembers it with persist', async () => {
    const { wrapper, map } = await mountMap({ persist: 'my-map' })
    map.jumpTo({ center: [10, 20], zoom: 5 })
    map.fire('moveend')
    expect(wrapper.emitted('update:center')?.at(-1)).toEqual([[10, 20]])
    expect(wrapper.emitted('update:zoom')?.at(-1)).toEqual([5])
    expect(JSON.parse(localStorage.getItem('my-map')!)).toMatchObject({ center: [10, 20], zoom: 5 })
  })

  it('starts from the remembered view over the props', async () => {
    localStorage.setItem('m3-map-view', JSON.stringify({ center: [1, 2], zoom: 9, bearing: 0, pitch: 0 }))
    const { map } = await mountMap({ persist: true, center: [5, 5], zoom: 3 })
    expect(map.options.center).toEqual([1, 2])
    expect(map.options.zoom).toBe(9)
  })

  it('moves the map when the v-model changes, ignoring equal values', async () => {
    const { wrapper, map } = await mountMap({ center: [0, 0], zoom: 1 })
    const jump = vi.spyOn(map, 'jumpTo')
    await wrapper.setProps({ center: [0, 0] })
    expect(jump).not.toHaveBeenCalled()
    await wrapper.setProps({ center: [3, 4], zoom: 7 })
    expect(map.getCenter()).toEqual({ lng: 3, lat: 4 })
    expect(map.getZoom()).toBe(7)
  })

  it('reloads a new style in full', async () => {
    const { wrapper, map } = await mountMap()
    await wrapper.setProps({ mapStyle: 'https://tiles.test/other.json' })
    expect(map.styles).toEqual(['https://tiles.test/other.json'])
  })

  it('emits clicks, renders its slot once the map exists and removes the map on unmount', async () => {
    const { wrapper, map } = await mountMap({}, () => h('p', { class: 'over' }, 'overlay'))
    expect(wrapper.find('.over').exists()).toBe(true)
    map.fire('click', { lngLat: { lng: 1, lat: 2 } })
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual({ lngLat: { lng: 1, lat: 2 } })
    wrapper.unmount()
    expect(map.removed).toBe(true)
  })
})

describe('MMapMarker', () => {
  it('places a theme-colored pin, and a custom element from its slot', async () => {
    await mountMap({}, () => [
      h(MMapMarker, { lngLat: [1, 2] }),
      h(MMapMarker, { lngLat: [3, 4], class: 'mine' }, { default: () => h('span', 'here') }),
    ])
    const [pin, custom] = created.markers
    expect(pin!.options.color).toBe('currentColor')
    expect(pin!.element.classList.contains('m3-map-marker--default')).toBe(true)
    expect(pin!.lngLat).toEqual({ lng: 1, lat: 2 })
    expect(custom!.element.textContent).toBe('here')
    // Attributes land on what's shown
    expect(custom!.element.classList.contains('mine')).toBe(true)
    expect(custom!.options.anchor).toBe('center')
  })

  it('emits its new position after a drag, and opens its #popup slot', async () => {
    const onUpdate = vi.fn()
    await mountMap({}, () => h(MMapMarker, { lngLat: [1, 2], draggable: true, 'onUpdate:lngLat': onUpdate }, { popup: () => h('b', 'Info') }))
    const marker = created.markers[0]!
    marker.setLngLat([5, 6])
    marker.fire('dragend')
    expect(onUpdate).toHaveBeenCalledWith([5, 6])
    expect(marker.popup?.content?.textContent).toBe('Info')
  })
})

describe('MMapPopup', () => {
  it('opens at lngLat, reports a close by the user, and closes from v-model without echoing it', async () => {
    const onUpdate = vi.fn()
    const Host = defineComponent({
      props: { open: Boolean },
      setup: (p) => () => h(MMap, { mapStyle: 's' }, () => h(MMapPopup, { lngLat: [1, 2], open: p.open, 'onUpdate:open': onUpdate }, () => 'Hello')),
    })
    const wrapper = mount(Host, { props: { open: true }, attachTo: document.body })
    await flushPromises()
    created.maps[0]!.load()
    await nextTick()
    await nextTick()
    const popup = created.popups[0]!
    expect(popup.isOpen()).toBe(true)
    expect(popup.content?.textContent).toBe('Hello')
    await wrapper.setProps({ open: false })
    expect(popup.isOpen()).toBe(false)
    expect(onUpdate).not.toHaveBeenCalled()
    await wrapper.setProps({ open: true })
    popup.remove()
    expect(onUpdate).toHaveBeenCalledWith(false)
  })
})

describe('MMapGeoJson', () => {
  const data = { type: 'FeatureCollection', features: [] } as const

  it('adds the source and theme-colored default layers, and updates the data', async () => {
    const Host = defineComponent({
      props: { data: Object },
      setup: (p) => () => h(MMap, { mapStyle: 's' }, () => h(MMapGeoJson, { id: 'parcels', data: p.data as never })),
    })
    const wrapper = mount(Host, { props: { data }, attachTo: document.body })
    await flushPromises()
    const map = created.maps[0]!
    map.load()
    await nextTick()
    await nextTick()
    expect(map.getSource('parcels')?.data).toEqual(data)
    expect(map.layers.map((l) => l.id)).toEqual(['parcels-fill', 'parcels-line', 'parcels-circle'])
    expect((map.getLayer('parcels-fill')!.paint as Record<string, string>)['fill-color']).toBe('#6750a4')
    const next = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }] }
    await wrapper.setProps({ data: next })
    expect(map.getSource('parcels')?.data).toEqual(next)
  })

  it('takes its own layers, comes back after a style change, emits clicks and cleans up', async () => {
    const onClick = vi.fn()
    const { wrapper, map } = await mountMap({}, () => h(MMapGeoJson, {
      id: 'roads',
      data,
      layers: [{ type: 'line', paint: { 'line-color': '#f00' } }],
      interactive: true,
      onClick,
    }))
    expect(map.layers.map((l) => l.id)).toEqual(['roads-0'])
    map.fire('click:roads-0', { features: [] })
    expect(onClick).toHaveBeenCalled()
    map.fire('mouseenter:roads-0')
    expect(map.getCanvas().style.cursor).toBe('pointer')
    // A new style drops sources and layers: they're added again on style.load
    map.setStyle('other')
    map.fire('style.load')
    await nextTick()
    expect(map.getSource('roads')).toBeTruthy()
    expect(map.layers.map((l) => l.id)).toEqual(['roads-0'])
    wrapper.unmount()
    expect(map.getSource('roads')).toBeUndefined()
  })
})

describe('MMapControl', () => {
  it('puts its content in a corner as a control group, and removes it on unmount', async () => {
    const Host = defineComponent({
      props: { show: Boolean },
      setup: (p) => () => h(MMap, { mapStyle: 's' }, () => (p.show ? h(MMapControl, { position: 'top-left' }, () => h('button', 'Layers')) : null)),
    })
    const wrapper = mount(Host, { props: { show: true }, attachTo: document.body })
    await flushPromises()
    const map = created.maps[0]!
    map.load()
    await nextTick()
    await nextTick()
    const control = map.controls.find((c) => c.position === 'top-left')!
    const el = control.control.onAdd!(map)
    expect(el.classList.contains('maplibregl-ctrl-group')).toBe(true)
    expect(el.textContent).toBe('Layers')
    await wrapper.setProps({ show: false })
    expect(map.controls.some((c) => c.position === 'top-left')).toBe(false)
  })
})

describe('useMap', () => {
  it('registers layer and map listeners once the map exists, and removes them on unmount', async () => {
    const onLayer = vi.fn()
    const Probe = defineComponent({
      setup() {
        const api = useMap()
        api.onLayer('click', 'parcels-fill', onLayer)
        api.on('moveend', () => {})
        return () => null
      },
    })
    const Host = defineComponent({
      props: { show: Boolean },
      setup: (p) => () => h(MMap, { mapStyle: 's' }, () => (p.show ? h(Probe) : null)),
    })
    const wrapper = mount(Host, { props: { show: true }, attachTo: document.body })
    await flushPromises()
    const map = created.maps[0]!
    const before = map.count('moveend')
    map.load()
    await nextTick()
    await nextTick()
    map.fire('click:parcels-fill', { features: [] })
    expect(onLayer).toHaveBeenCalledTimes(1)
    expect(map.count('moveend')).toBe(before + 1)
    await wrapper.setProps({ show: false })
    expect(map.count('click:parcels-fill')).toBe(0)
    expect(map.count('moveend')).toBe(before)
  })

  it('throws outside an MMap', () => {
    expect(() => mount(defineComponent({ setup() { useMap(); return () => null } }))).toThrow(/inside <MMap>/)
  })
})
