import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

// MapLibre needs WebGL, which happy-dom lacks: a stand-in (see _fakeMaplibre.ts)
import { created, FakeMap } from './_fakeMaplibre'
vi.mock('maplibre-gl', async () => (await import('./_fakeMaplibre')).fakeModule)

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
    expect(controlNames(map)).toEqual(['NavigationControl@top-right', 'ScaleControl@bottom-left'])
    await wrapper.setProps({ geolocate: true, navigation: 'top-left', scale: false })
    expect(controlNames(map).sort()).toEqual(['GeolocateControl@top-right', 'NavigationControl@top-left'])
  })

  it('credits the sources the style uses in an attribution of its own, open until the map is dragged', async () => {
    const wrapper = mount(MMap, { props: { mapStyle: 's' }, attachTo: document.body })
    await flushPromises()
    const map = created.maps.at(-1)!
    Object.assign(map.style, {
      sources: {
        osm: { attribution: '<a href="https://osm.org">© OpenStreetMap</a>' },
        tiles: { attribution: '© OpenStreetMap' },
        unused: { attribution: 'Not drawn' },
      },
      layers: [{ id: 'a', type: 'raster', source: 'osm' }, { id: 'b', type: 'fill', source: 'tiles' }],
    })
    map.load()
    await nextTick()
    await nextTick()
    const attribution = () => map.controls.find((c) => c.position === 'bottom-right')?.control.onAdd!(map)
    const el = attribution()!
    expect(el.classList.contains('m3-map-attrib')).toBe(true)
    // Unused sources left out, one contained in another dropped, links kept
    expect(el.querySelector('.m3-map-attrib-text')!.textContent).toBe('© OpenStreetMap')
    expect(el.querySelector('a')?.getAttribute('href')).toBe('https://osm.org')

    map.fire('dragstart')
    await nextTick()
    expect(el.querySelector('.m3-map-attrib-text')).toBeNull()
    el.querySelector<HTMLElement>('button')!.click()
    await nextTick()
    expect(el.querySelector('.m3-map-attrib-text')).not.toBeNull()

    await wrapper.setProps({ attribution: 'top-left' })
    await nextTick()
    expect(map.controls.some((c) => c.position === 'top-left')).toBe(true)
    await wrapper.setProps({ attribution: false })
    await nextTick()
    expect(map.controls.map((c) => c.position).sort()).toEqual(['bottom-left', 'top-right'])
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

describe('MMap control tooltips', () => {
  it('shows an M3 tooltip instead of the browser\'s for buttons in its controls', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper } = await mountMap({}, () => h('div', { class: 'maplibregl-ctrl' }, [h('button', { title: 'Layers' })]))
      await nextTick()
      const button = wrapper.find('.maplibregl-ctrl button')
      // No native tooltip; the text stays as its accessible name
      expect(button.attributes('title')).toBeUndefined()
      expect(button.attributes('data-m3-tip')).toBe('Layers')
      expect(button.attributes('aria-label')).toBe('Layers')
      await button.trigger('pointerover', { pointerType: 'mouse' })
      expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
      vi.advanceTimersByTime(600)
      await nextTick()
      expect(wrapper.find('[role="tooltip"]').text()).toBe('Layers')
      await button.trigger('pointerout', { relatedTarget: document.body })
      expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
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
    // Removed by MMapGeoJson before MMap removed the map
    expect(map.sources.has('roads')).toBe(false)
  })
})

describe('unmounting', () => {
  it('lets the map components clean up before removing the map (leaving the page)', async () => {
    const errors: unknown[] = []
    const { wrapper, map } = await mountMap({}, () => [
      h(MMapGeoJson, { id: 'zones', data: { type: 'FeatureCollection', features: [] } }),
      h(MMapMarker, { lngLat: [0, 0] }),
      h(MMapControl, () => h('button', 'x')),
    ])
    wrapper.vm.$.appContext.config.errorHandler = (e) => { errors.push(e) }
    wrapper.unmount()
    expect(errors).toEqual([])
    expect(map.removed).toBe(true)
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
  /** An MMapControl with a #panel: a layers button that expands into a list. */
  async function mountExpanding(expanded?: boolean) {
    const onExpanded = vi.fn()
    const wrapper = await mountMap({}, () =>
      h(MMapControl, { position: 'top-left', expanded, 'onUpdate:expanded': onExpanded }, {
        default: ({ toggle }: { toggle: () => void }) => h('button', { class: 'open', onClick: toggle }, 'Layers'),
        panel: ({ close }: { close: () => void }) => h('div', { class: 'panel' }, [h('span', 'Satellite'), h('button', { class: 'shut', onClick: close }, 'x')]),
      }),
    )
    const control = wrapper.map.controls.find((c) => c.position === 'top-left')!
    const el = control.control.onAdd!(wrapper.map) as HTMLElement
    document.body.appendChild(el)
    return { ...wrapper, el, onExpanded }
  }

  it('a #panel expands the control in place on toggle, and closes from inside it, on Escape or outside', async () => {
    const { el, onExpanded } = await mountExpanding()
    expect(el.classList.contains('maplibregl-ctrl-group')).toBe(true)
    el.querySelector<HTMLElement>('.open')!.click()
    await nextTick()
    expect(onExpanded).toHaveBeenLastCalledWith(true)
    expect(el.querySelector('.panel')).not.toBeNull()
    // The panel isn't a control group: its buttons keep their own look
    expect(el.classList.contains('maplibregl-ctrl-group')).toBe(false)
    expect(el.classList.contains('m3-map-control-panel')).toBe(true)

    el.querySelector<HTMLElement>('.shut')!.click()
    await nextTick()
    expect(onExpanded).toHaveBeenLastCalledWith(false)
    expect(el.querySelector('.panel')).toBeNull()

    el.querySelector<HTMLElement>('.open')!.click()
    await nextTick()
    // A press inside it doesn't close it
    el.querySelector('.panel')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(el.querySelector('.panel')).not.toBeNull()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(el.querySelector('.panel')).toBeNull()

    el.querySelector<HTMLElement>('.open')!.click()
    await nextTick()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(el.querySelector('.panel')).toBeNull()
  })

  it('opens expanded from v-model:expanded', async () => {
    const { el } = await mountExpanding(true)
    expect(el.querySelector('.panel')).not.toBeNull()
  })

  it('springs its size from the old one when its content resizes', async () => {
    let report: () => void = () => {}
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { report = cb } observe() {} disconnect() {} })
    const sizes = [{ w: 40, h: 40 }, { w: 220, h: 160 }]
    let i = 0
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => sizes[i]!.w)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => sizes[i]!.h)
    const { el } = await mountExpanding()
    report()
    i = 1
    el.querySelector<HTMLElement>('.open')!.click()
    await nextTick()
    report()
    const [grow] = el.getAnimations()
    const frames = (grow!.effect as KeyframeEffect).getKeyframes()
    expect([frames[0]!.width, frames[0]!.height]).toEqual(['40px', '40px'])
    expect([frames.at(-1)!.width, frames.at(-1)!.height]).toEqual(['220px', '160px'])
    expect(el.style.overflow).toBe('hidden')
    grow!.finish()
    expect(el.style.overflow).toBe('')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
