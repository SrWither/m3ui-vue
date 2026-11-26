import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { created, type FakeMap } from './_fakeMaplibre'

vi.mock('maplibre-gl', async () => (await import('./_fakeMaplibre')).fakeModule)

const { MMap, MMapDraw, MMapIdentify, orvianAdapter } = await import('../map')
type Collection = { type: 'FeatureCollection'; features: { id?: string | number; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> | null }[] }

beforeEach(() => {
  created.maps = []
  created.markers = []
  created.popups = []
  document.documentElement.lang = 'en'
  document.documentElement.style.setProperty('--color-primary', '#6750a4')
  document.documentElement.style.setProperty('--color-surface', '#fef7ff')
})
afterEach(() => { document.body.innerHTML = '' })

/** An MMap with an MMapDraw bound to a ref (v-model), like a consumer. */
async function mountDraw(initial?: Collection, extra: Record<string, unknown> = {}, more?: () => unknown) {
  const shapes = ref<Collection | undefined>(initial)
  const onSelect = vi.fn()
  const Host = defineComponent({
    setup: () => () => h(MMap, { mapStyle: 's', ...(more ? { adapter: orvianAdapter() } : {}) }, () => [
      h(MMapDraw, { modelValue: shapes.value as never, 'onUpdate:modelValue': (v: Collection) => (shapes.value = v), onSelect, ...extra }),
      more?.(),
    ]),
  })
  const wrapper = mount(Host, { attachTo: document.body })
  await flushPromises()
  const map = created.maps.at(-1)! as FakeMap
  map.load()
  await nextTick()
  await nextTick()
  return { wrapper, map, shapes, onSelect }
}

const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
const press = async (label: string) => { button(label).click(); await nextTick() }
const click = (map: FakeMap, lng: number, lat: number) =>
  map.fire('click', { target: map, lngLat: { lng, lat }, point: map.project([lng, lat]) })
const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }))
const sourceData = (map: FakeMap, suffix: string) =>
  [...map.sources.entries()].find(([id]) => id.endsWith(suffix))![1].data as { features: { geometry: { type: string }; properties: Record<string, unknown> }[] }
/** Pretend the pointer is over this shape (what queryRenderedFeatures finds) */
const hover = (map: FakeMap, id: string) => {
  const layer = map.layers.find((l) => l.id.endsWith('-shapes-line'))!.id
  map.rendered = [{ layer: { id: layer }, properties: { __draw_id: id } }]
}

describe('MMapDraw', () => {
  it('draws a point with one click', async () => {
    const { map, shapes, onSelect } = await mountDraw()
    await press('Draw a point')
    expect(map.canvas.style.cursor).toBe('crosshair')
    click(map, -64.19, -31.42)
    await nextTick()
    expect(shapes.value!.features).toHaveLength(1)
    expect(shapes.value!.features[0]).toMatchObject({ type: 'Feature', id: 'shape-1', geometry: { type: 'Point', coordinates: [-64.19, -31.42] }, properties: {} })
    expect(map.canvas.style.cursor).toBe('')
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'shape-1' }))
  })

  it('draws a line, finished with Enter, with Backspace taking back a point', async () => {
    const { map, shapes } = await mountDraw()
    await press('Draw a line')
    click(map, 0, 0)
    click(map, 1, 1)
    click(map, 2, 2)
    key('Backspace')
    key('Enter')
    await nextTick()
    expect(shapes.value!.features[0]!.geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })
  })

  it('closes a polygon by clicking its first point, and drops one with too few points', async () => {
    const { map, shapes } = await mountDraw()
    await press('Draw a polygon')
    click(map, 0, 0)
    click(map, 0.1, 0)
    click(map, 0.1, 0.1)
    click(map, 0.0001, 0.0001) // within 20px of the first point
    await nextTick()
    expect(shapes.value!.features[0]!.geometry).toEqual({ type: 'Polygon', coordinates: [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0]]] })
    await press('Draw a polygon')
    click(map, 1, 1)
    click(map, 1.1, 1)
    key('Escape')
    await nextTick()
    expect(shapes.value!.features).toHaveLength(1)
  })

  it('selects a shape on click, deletes it with Delete, and keeps others\' ids and properties', async () => {
    const initial: Collection = {
      type: 'FeatureCollection',
      features: [
        { id: 7, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Road' } },
        { geometry: { type: 'Point', coordinates: [2, 2] }, properties: { name: 'Stop' } },
      ],
    }
    const { map, shapes, onSelect } = await mountDraw(initial)
    hover(map, '7')
    click(map, 0.5, 0.5)
    await nextTick()
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 7, properties: { name: 'Road' } }))
    expect(sourceData(map, '-shapes').features[0]!.properties).toMatchObject({ name: 'Road', __draw_selected: true })
    // Its handles: two vertices and a midpoint
    expect(sourceData(map, '-handles').features.map((f) => f.properties.handle)).toEqual(['vertex', 'vertex', 'midpoint'])
    expect(button('Delete the selected shape').disabled).toBe(false)
    key('Delete')
    await nextTick()
    expect(shapes.value!.features).toHaveLength(1)
    expect(shapes.value!.features[0]).toMatchObject({ id: 'shape-1', properties: { name: 'Stop' } })
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('clears the selection on a click on empty map', async () => {
    const { map, onSelect } = await mountDraw({ type: 'FeatureCollection', features: [{ id: 'a', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }] })
    hover(map, 'a')
    click(map, 0, 0)
    map.rendered = []
    click(map, 5, 5)
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('drags a vertex, adds one from a midpoint and removes one with a double click', async () => {
    const { map, shapes } = await mountDraw({ type: 'FeatureCollection', features: [{ id: 'l', geometry: { type: 'LineString', coordinates: [[0, 0], [2, 0]] }, properties: {} }] })
    hover(map, 'l')
    click(map, 1, 0)
    const vertex = map.layers.find((l) => l.id.endsWith('-handles-vertex'))!.id
    const mid = map.layers.find((l) => l.id.endsWith('-handles-midpoint'))!.id
    const down = (layer: string, properties: Record<string, unknown>, lng: number, lat: number) =>
      map.fire(`mousedown:${layer}`, { type: 'mousedown', features: [{ properties }], lngLat: { lng, lat }, preventDefault() {} })
    // Move the second vertex
    down(vertex, { handle: 'vertex', v: 1 }, 2, 0)
    map.fire('mousemove', { lngLat: { lng: 3, lat: 1 } })
    map.fire('mouseup')
    expect(shapes.value!.features[0]!.geometry.coordinates).toEqual([[0, 0], [3, 1]])
    // Pull the midpoint out: a new vertex in between
    down(mid, { handle: 'midpoint', after: 0 }, 1.5, 0.5)
    map.fire('mousemove', { lngLat: { lng: 1.5, lat: 2 } })
    map.fire('mouseup')
    expect(shapes.value!.features[0]!.geometry.coordinates).toEqual([[0, 0], [1.5, 2], [3, 1]])
    // Double-click the new vertex away; a line keeps at least two
    map.fire(`dblclick:${vertex}`, { features: [{ properties: { handle: 'vertex', v: 1 } }], preventDefault() {} })
    expect(shapes.value!.features[0]!.geometry.coordinates).toEqual([[0, 0], [3, 1]])
    map.fire(`dblclick:${vertex}`, { features: [{ properties: { handle: 'vertex', v: 1 } }], preventDefault() {} })
    expect(shapes.value!.features[0]!.geometry.coordinates).toEqual([[0, 0], [3, 1]])
  })

  it('reloads when the v-model changes from outside', async () => {
    const { map, shapes } = await mountDraw()
    shapes.value = { type: 'FeatureCollection', features: [{ id: 'x', geometry: { type: 'Point', coordinates: [4, 4] }, properties: {} }] }
    await nextTick()
    expect(sourceData(map, '-shapes').features).toHaveLength(1)
  })

  it('keeps MMapIdentify quiet while drawing', async () => {
    const onIdentify = vi.fn()
    const { map } = await mountDraw(undefined, {}, () => h(MMapIdentify, { onIdentify }))
    await press('Draw a line')
    click(map, 1, 1)
    expect(onIdentify).not.toHaveBeenCalled()
    key('Escape')
    click(map, 1, 1)
    expect(onIdentify).toHaveBeenCalledTimes(1)
  })

  it('draws only with editable false, and starts from v-model:mode', async () => {
    const onMode = vi.fn()
    const { map, onSelect } = await mountDraw(undefined, { editable: false, mode: 'point', 'onUpdate:mode': onMode })
    expect(document.querySelector('button[aria-label="Delete the selected shape"]')).toBeNull()
    click(map, 1, 1)
    await nextTick()
    expect(onMode).toHaveBeenLastCalledWith(null)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('cleans up its layers and sources on unmount', async () => {
    const { wrapper, map } = await mountDraw()
    expect(map.sources.size).toBe(3)
    wrapper.unmount()
    expect(map.sources.size).toBe(0)
    expect(map.layers).toEqual([])
  })
})
