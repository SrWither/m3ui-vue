import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { created, type FakeMap } from './_fakeMaplibre'
import { centroid, distance, midpoint, pathLength, ringArea } from '../composables/_mapGeometry'

vi.mock('maplibre-gl', async () => (await import('./_fakeMaplibre')).fakeModule)

const { MMap, MMapMeasure, MMapIdentify, MMapFilter, MMapSearch, orvianAdapter, nominatimProvider } = await import('../map')

beforeEach(() => {
  created.maps = []
  created.markers = []
  created.popups = []
  document.documentElement.lang = 'en'
  document.documentElement.style.setProperty('--color-primary', '#6750a4')
  document.documentElement.style.setProperty('--color-surface', '#fef7ff')
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountMap(slot: () => unknown, props: Record<string, unknown> = {}) {
  const wrapper = mount(MMap, { props: { mapStyle: 's', ...props }, slots: { default: slot }, attachTo: document.body })
  await flushPromises()
  const map = created.maps.at(-1)! as FakeMap
  map.load()
  await nextTick()
  await nextTick()
  return { wrapper, map }
}

// Controls are moved out of the wrapper into the map's corners (document.body with the stand-in)
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[title="${label}"], button[aria-label="${label}"]`)!
const press = async (label: string) => { button(label).click(); await nextTick() }

const click = (map: FakeMap, lng: number, lat: number) =>
  map.fire('click', { target: map, lngLat: { lng, lat }, point: map.project([lng, lat]) })

describe('map geometry (turf\'s numbers)', () => {
  // The same path checked against @turf/turf 7: length 8735.186 m, area 8967717.4 m²
  const path: [number, number][] = [[-64.19, -31.42], [-64.17, -31.41], [-64.15, -31.43], [-64.18, -31.45]]

  it('measures lengths, areas and midpoints on the sphere', () => {
    expect(pathLength(path)).toBeCloseTo(8735.186, 2)
    expect(ringArea(path)).toBeCloseTo(8967717.4, 0)
    const [lng, lat] = midpoint(path[0]!, path[1]!)
    expect(lng).toBeCloseTo(-64.1799995, 6)
    expect(lat).toBeCloseTo(-31.4150004, 6)
    expect(distance(path[0]!, path[0]!)).toBe(0)
    expect(ringArea(path.slice(0, 2))).toBe(0)
  })

  it('labels a polygon at its centroid', () => {
    const [lng, lat] = centroid([[0, 0], [2, 0], [2, 2], [0, 2]])
    expect(lng).toBeCloseTo(1)
    expect(lat).toBeCloseTo(1)
  })
})

describe('MMapMeasure', () => {
  it('measures a distance: points on click, labels per segment and in total, finished with Enter', async () => {
    const onChange = vi.fn()
    const { map, wrapper } = await mountMap(() => h(MMapMeasure, { onChange }))
    await press('Measure distance')
    expect(map.canvas.style.cursor).toBe('crosshair')
    expect(map.doubleClickZoom.enabled).toBe(false)
    click(map, -64.19, -31.42)
    click(map, -64.17, -31.41)
    await nextTick()
    const texts = () => created.markers.filter((m) => m.map).map((m) => m.element.textContent?.trim())
    expect(texts()).toContain('Total: 2.20 km')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await nextTick()
    const measurements = onChange.mock.calls.at(-1)![0]
    expect(measurements).toHaveLength(1)
    expect(measurements[0].mode).toBe('distance')
    expect(measurements[0].length).toBeCloseTo(pathLength([[-64.19, -31.42], [-64.17, -31.41]]), 3)
    expect(map.canvas.style.cursor).toBe('')
    expect(map.doubleClickZoom.enabled).toBe(true)
  })

  it('measures an area, closed at the end, with its label in m², ha or km²', async () => {
    const onChange = vi.fn()
    const { map, wrapper } = await mountMap(() => h(MMapMeasure, { onChange }))
    await press('Measure area')
    for (const [lng, lat] of [[-64.19, -31.42], [-64.17, -31.41], [-64.15, -31.43], [-64.18, -31.45]]) click(map, lng!, lat!)
    await nextTick()
    expect(created.markers.filter((m) => m.map).map((m) => m.element.textContent?.trim())).toContain('8.97 km²')
    // Pressing the active button again finishes
    await press('Measure area')
    const [m] = onChange.mock.calls.at(-1)![0]
    expect(m.closed).toBe(true)
    expect(m.points.at(-1)).toEqual(m.points[0])
    expect(m.area).toBeCloseTo(8967717, -1)
  })

  it('closes a shape on its first point, and clears everything', async () => {
    const onChange = vi.fn()
    const { map, wrapper } = await mountMap(() => h(MMapMeasure, { onChange }))
    await press('Measure distance')
    click(map, -64.19, -31.42)
    click(map, -64.17, -31.41)
    click(map, -64.15, -31.43)
    click(map, -64.1901, -31.4201) // within 20px of the first point
    await nextTick()
    expect(onChange.mock.calls.at(-1)![0][0].closed).toBe(true)
    await press('Clear measurements')
    expect(onChange.mock.calls.at(-1)![0]).toEqual([])
  })

  it('deletes one measurement from the ✕ on its label', async () => {
    const onChange = vi.fn()
    const { map } = await mountMap(() => h(MMapMeasure, { onChange }))
    for (const pts of [[[-64.19, -31.42], [-64.17, -31.41]], [[-64.1, -31.3], [-64.08, -31.31]]]) {
      await press('Measure distance')
      for (const [lng, lat] of pts) click(map, lng!, lat!)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await nextTick()
    }
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(2)
    const deletes = () => [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Delete measurement"]')].filter((b) => created.markers.some((m) => m.map && m.element.contains(b)))
    expect(deletes()).toHaveLength(2)
    deletes()[0]!.click()
    await nextTick()
    const left = onChange.mock.calls.at(-1)![0]
    expect(left).toHaveLength(1)
    expect(left[0].points[0]).toEqual([-64.1, -31.3])
  })

  it('takes Escape from the browser while measuring in fullscreen (Keyboard Lock), and gives it back', async () => {
    const lock = vi.fn(async () => {})
    const unlock = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, keyboard: { lock, unlock } })
    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true })
    try {
      const { map } = await mountMap(() => h(MMapMeasure))
      await press('Measure distance')
      expect(lock).toHaveBeenCalledWith(['Escape'])
      await Promise.resolve()
      click(map, 1, 1)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(map.canvas.style.cursor).toBe('')
      // Still locked until that Escape is let go: unlocking during its keydown lets the browser leave fullscreen
      expect(unlock).not.toHaveBeenCalled()
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }))
      await new Promise((r) => setTimeout(r))
      expect(unlock).toHaveBeenCalled()
    } finally {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
    }
  })

  it('keeps MMapIdentify quiet while measuring', async () => {
    const onIdentify = vi.fn()
    const { map, wrapper } = await mountMap(() => [h(MMapMeasure), h(MMapIdentify, { onIdentify })], { adapter: orvianAdapter() })
    await press('Measure distance')
    click(map, 1, 1)
    expect(onIdentify).not.toHaveBeenCalled()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    click(map, 1, 1)
    expect(onIdentify).toHaveBeenCalledTimes(1)
  })

  it('starts from v-model', async () => {
    const onUpdate = vi.fn()
    const Host = defineComponent({
      props: { mode: { type: String, default: null } },
      setup: (p) => () => h(MMap, { mapStyle: 's' }, () => h(MMapMeasure, { modelValue: p.mode as never, control: false, 'onUpdate:modelValue': onUpdate })),
    })
    const wrapper = mount(Host, { attachTo: document.body })
    await flushPromises()
    const map = created.maps.at(-1)!
    map.load()
    await nextTick()
    await nextTick()
    await wrapper.setProps({ mode: 'area' })
    expect(map.canvas.style.cursor).toBe('crosshair')
    await wrapper.setProps({ mode: null })
    expect(map.canvas.style.cursor).toBe('')
  })
})

describe('MMapFilter', () => {
  it('filters a layer by the selected values, keeping the style\'s own filter', async () => {
    const { map, wrapper } = await mountMap(() => h(MMapFilter, { layer: 'places', property: 'kind', values: ['Library', 'Market'] }))
    map.style = { layers: [{ id: 'places', type: 'circle', filter: ['==', ['get', 'open'], true] } as never] }
    await nextTick()
    const chips = wrapper.findAll('button, [role="button"], .cursor-pointer').filter((c) => /Library|Market/.test(c.text()))
    await chips.find((c) => c.text().includes('Market'))!.trigger('click')
    expect(map.filters.get('places')).toEqual(['all', ['==', ['get', 'open'], true], ['in', ['get', 'kind'], ['literal', ['Market']]]])
    await chips.find((c) => c.text().includes('Market'))!.trigger('click')
    expect(map.filters.get('places')).toEqual(['==', ['get', 'open'], true])
  })
})

describe('MMapSearch', () => {
  it('searches on Enter through its provider, and flies to the picked result with a marker', async () => {
    const provider = vi.fn(async () => [{ label: 'Plaza San Martín', lngLat: [-64.1836, -31.4167] as [number, number], type: 'park' }])
    const onSelect = vi.fn()
    const { map } = await mountMap(() => h(MMapSearch, { provider, onSelect }))
    const input = document.querySelector('input[type="search"]') as HTMLInputElement
    input.value = 'plaza'
    input.dispatchEvent(new Event('input'))
    expect(provider).not.toHaveBeenCalled()
    input.form!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(provider).toHaveBeenCalledWith('plaza', expect.any(AbortSignal))
    const item = [...document.querySelectorAll<HTMLElement>('li, [role="listitem"], [role="button"]')].find((e) => e.textContent?.includes('Plaza San Martín'))!
    expect(item).toBeTruthy()
    item.click()
    await nextTick()
    expect(map.flights.at(-1)).toEqual(['flyTo', { center: [-64.1836, -31.4167], zoom: 17 }])
    expect(onSelect).toHaveBeenCalled()
    await nextTick()
    expect(created.markers.some((m) => m.map && m.lngLat.lng === -64.1836)).toBe(true)
  })

  it('nominatimProvider asks Nominatim and reads its results and extents', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { display_name: 'Córdoba, Argentina', lat: '-31.41', lon: '-64.18', type: 'city', boundingbox: ['-31.5', '-31.3', '-64.3', '-64.0'] },
    ])))
    vi.stubGlobal('fetch', fetchMock)
    const [result] = await nominatimProvider({ countryCodes: ['ar'], language: 'es' })('córdoba', new AbortController().signal)
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]))
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(url.searchParams.get('q')).toBe('córdoba')
    expect(url.searchParams.get('countrycodes')).toBe('ar')
    expect(url.searchParams.get('accept-language')).toBe('es')
    expect(result).toEqual({ label: 'Córdoba, Argentina', lngLat: [-64.18, -31.41], bbox: [-64.3, -31.5, -64.0, -31.3], type: 'city' })
  })
})
