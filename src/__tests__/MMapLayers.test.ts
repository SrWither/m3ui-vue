import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { StyleSpecification } from 'maplibre-gl'
import { created, type FakeMap } from './_fakeMaplibre'

vi.mock('maplibre-gl', async () => (await import('./_fakeMaplibre')).fakeModule)

const { MMap, MMapLayers, MMapBaseLayers, MMapIdentify, MMapHover, MMapFilter, useMap, useMapLayers, orvianAdapter, genericAdapter, formatFieldValue, identifyFeatures } = await import('../map')

// A style the way the Orvian viewers write it (served by mvt-rs)
const STYLE_URL = 'https://tiles.test/services/styles/public:city'
function orvianStyle() {
  return {
    version: 8,
    name: 'City',
    metadata: { groups: [{ name: 'land', alias: 'Land use' }, { name: 'net', alias: 'Networks' }] },
    sources: {},
    layers: [
      { id: 'bg', type: 'background' },
      { id: 'osm', type: 'raster', metadata: { isbaselayer: true, image: 'osm.png', alias: 'OpenStreetMap' } },
      { id: 'sat', type: 'raster', layout: { visibility: 'none' }, metadata: { isbaselayer: true, image: 'https://img.test/sat.png', alias: 'Satellite' } },
      {
        id: 'parcels',
        type: 'fill',
        paint: { 'fill-opacity': 0.5 },
        metadata: {
          alias: 'Parcels',
          group: 'land',
          description: 'Cadastral parcels',
          identify: true,
          childs: ['parcels-line'],
          fields: { area: { alias: 'Area', suffix: 'm²', mask: '#,###.00' }, secret: { show: false }, exclude: ['gid'] },
          hover: { enable: true, fields: [{ owner: { alias: 'Owner' } }, { area: { alias: 'Area', mask: '#,###' } }] },
          download: 'https://tiles.test/parcels.zip',
        },
      },
      { id: 'parcels-line', type: 'line', metadata: { show_in_layerlist: false, group: 'land' } },
      { id: 'zoning', type: 'fill', metadata: { alias: 'Zoning', group: 'land', legend: { show: false } } },
      { id: 'roads', type: 'line', metadata: { alias: 'Roads', group: 'net', legend: { wmslegend: 'https://legend.test/roads.png' } } },
      { id: 'poi', type: 'circle', metadata: { alias: 'Points of interest' } },
    ],
  }
}

beforeEach(() => {
  created.maps = []
  created.markers = []
  created.popups = []
  document.documentElement.lang = 'en'
})
afterEach(() => { document.body.innerHTML = '' })

describe('orvianAdapter', () => {
  const model = orvianAdapter()(orvianStyle() as unknown as StyleSpecification, { styleUrl: STYLE_URL })
  const layer = (id: string) => model.layers.find((l) => l.id === id)!

  it('reads names, groups, base layers and the list', () => {
    expect(model.title).toBe('City')
    expect(model.groups).toEqual([{ name: 'land', title: 'Land use' }, { name: 'net', title: 'Networks' }])
    expect(model.layers.map((l) => l.id)).not.toContain('bg')
    expect(layer('osm')).toMatchObject({ title: 'OpenStreetMap', listed: false, base: { image: 'osm.png' } })
    expect(layer('parcels')).toMatchObject({ title: 'Parcels', group: 'land', description: 'Cadastral parcels', listed: true, children: ['parcels-line'], download: 'https://tiles.test/parcels.zip' })
    expect(layer('parcels-line').listed).toBe(false)
  })

  it('reads identify formats and exclusions, and flattens hover fields', () => {
    expect(layer('parcels').identify).toEqual({
      format: { area: { label: 'Area', prefix: undefined, suffix: 'm²', mask: '#,###.00', hidden: false }, secret: { label: undefined, prefix: undefined, suffix: undefined, mask: undefined, hidden: true } },
      exclude: ['gid'],
    })
    expect(layer('roads').identify).toBe(false)
    expect(layer('parcels').hover).toEqual({ fields: [{ key: 'owner', label: 'Owner', prefix: undefined, suffix: undefined, mask: undefined }, { key: 'area', label: 'Area', prefix: undefined, suffix: undefined, mask: '#,###' }] })
    expect(layer('roads').hover).toBe(false)
  })

  it('takes legends from mvt-rs, a wmslegend, or none', () => {
    expect(layer('parcels').legend).toBe('https://tiles.test/services/legends/public:city?has_label=false&include_raster=true&layer_id=parcels')
    expect(layer('zoning').legend).toBeUndefined()
    expect(layer('roads').legend).toBe('https://legend.test/roads.png')
    expect(layer('osm').legend).toBeUndefined()
    // Not an mvt-rs style: no legend service
    const other = orvianAdapter()(orvianStyle() as unknown as StyleSpecification, { styleUrl: 'https://x.test/style.json' })
    expect(other.layers.find((l) => l.id === 'parcels')!.legend).toBeUndefined()
  })
})

describe('genericAdapter', () => {
  it('lists every layer under its id, identifying vector ones', () => {
    const model = genericAdapter(orvianStyle() as unknown as StyleSpecification, {})
    expect(model.layers.find((l) => l.id === 'roads')).toMatchObject({ title: 'roads', listed: true, identify: { format: {}, exclude: [] }, hover: false })
    expect(model.layers.find((l) => l.id === 'osm')!.identify).toBe(false)
  })
})

describe('formatFieldValue', () => {
  it('applies the mask in the page\'s language, then prefix and suffix', () => {
    expect(formatFieldValue(1234.5, { mask: '#,###.00', suffix: 'm²' })).toBe('1,234.50 m²')
    document.documentElement.lang = 'es'
    expect(formatFieldValue('1234.5', { mask: '#,###.00' })).toBe('1.234,50')
    expect(formatFieldValue(1234567, { mask: '#,###' })).toBe('1.234.567')
    expect(formatFieldValue(3, { prefix: '$' })).toBe('$ 3')
    expect(formatFieldValue('', {})).toBe('')
    expect(formatFieldValue(null)).toBe('')
  })
})

/** An MMap with the Orvian style loaded, and a probe exposing useMapLayers(). */
async function mountWithLayers(slot?: () => unknown) {
  let api!: ReturnType<typeof useMapLayers>
  const Probe = defineComponent({ setup() { api = useMapLayers(); return () => null } })
  const wrapper = mount(MMap, {
    props: { mapStyle: STYLE_URL, adapter: orvianAdapter() },
    slots: { default: () => [h(Probe), slot?.()] },
    attachTo: document.body,
  })
  await flushPromises()
  const map = created.maps.at(-1)! as FakeMap
  map.style = orvianStyle() as never
  map.load()
  await nextTick()
  await nextTick()
  return { wrapper, map, api: () => api }
}

describe('useMapLayers', () => {
  it('reads visibility and opacity, toggles layers with their children, and fades them by type', async () => {
    const { map, api } = await mountWithLayers()
    expect(api().isVisible('sat')).toBe(false)
    expect(api().opacityOf('parcels')).toBe(0.5)
    api().setVisible('parcels', false)
    expect(map.getLayoutProperty('parcels', 'visibility')).toBe('none')
    expect(map.getLayoutProperty('parcels-line', 'visibility')).toBe('none')
    api().setOpacity('poi', 0.3)
    expect(map.getPaintProperty('poi', 'circle-opacity')).toBe(0.3)
    expect(map.getPaintProperty('poi', 'circle-stroke-opacity')).toBe(0.3)
  })

  it('shows and hides groups, with a partial state', async () => {
    const { api } = await mountWithLayers()
    expect(api().layersOf('land').map((l) => l.id)).toEqual(['parcels', 'zoning'])
    expect(api().layersOf(null).map((l) => l.id)).toEqual(['poi'])
    expect(api().groupState('land')).toBe('visible')
    api().setVisible('zoning', false)
    expect(api().groupState('land')).toBe('partial')
    api().setGroupVisible('land', false)
    expect(api().groupState('land')).toBe('hidden')
  })

  it('shows one base layer at a time, or none', async () => {
    const { map, api } = await mountWithLayers()
    expect(api().baseLayer.value).toBe('osm')
    api().setBaseLayer('sat')
    expect(api().baseLayer.value).toBe('sat')
    expect(map.getLayoutProperty('osm', 'visibility')).toBe('none')
    api().setBaseLayer(null)
    expect(api().baseLayer.value).toBeNull()
  })
})

describe('MMapLayers', () => {
  it('lists the groups and their layers, filters by search, and toggles from the list', async () => {
    const { wrapper, map } = await mountWithLayers(() => h(MMapLayers))
    const text = wrapper.text()
    expect(text).toContain('Land use')
    expect(text).toContain('Networks')
    expect(text).toContain('Parcels')
    expect(text).toContain('Points of interest')
    expect(text).not.toContain('parcels-line')
    expect(text).toContain('2/2')
    await wrapper.find('button[aria-label="Hide layer"]').trigger('click')
    expect(map.getLayoutProperty('parcels', 'visibility')).toBe('none')
    await wrapper.find('input').setValue('road')
    expect(wrapper.text()).toContain('Roads')
    expect(wrapper.text()).not.toContain('Parcels')
  })
})

describe('MMapBaseLayers', () => {
  it('switches base layers from their thumbnails, prefixing relative images', async () => {
    const { wrapper, map } = await mountWithLayers(() => h(MMapBaseLayers, { imageBase: '/images/' }))
    const imgs = wrapper.findAll('img').map((i) => i.attributes('src'))
    expect(imgs).toEqual(['/images/osm.png', 'https://img.test/sat.png'])
    await wrapper.find('button[aria-label="Satellite"]').trigger('click')
    expect(map.getLayoutProperty('sat', 'visibility')).toBe('visible')
    expect(map.getLayoutProperty('osm', 'visibility')).toBe('none')
    await wrapper.find('button[aria-label="No base layer"]').trigger('click')
    expect(map.getLayoutProperty('sat', 'visibility')).toBe('none')
  })
})

describe('outside the map', () => {
  // A side panel next to the map: the MMap's template ref reaches the panels through their `map` prop
  async function mountBeside() {
    const mapRef = ref()
    let api!: ReturnType<typeof useMap>
    const Own = defineComponent({ props: { map: Object }, setup(props) { api = useMap(() => props.map as never); return () => null } })
    const wrapper = mount(defineComponent({
      setup: () => () => h('div', [
        h('aside', [
          h(MMapLayers, { map: mapRef.value, search: false }),
          h(MMapBaseLayers, { map: mapRef.value }),
          h(MMapFilter, { map: mapRef.value, layer: 'poi', property: 'kind', values: ['cafe', 'park'] }),
          h(Own, { map: mapRef.value }),
        ]),
        h(MMap, { ref: mapRef, mapStyle: STYLE_URL, adapter: orvianAdapter() }),
      ]),
    }), { attachTo: document.body })
    await flushPromises()
    const map = created.maps.at(-1)! as FakeMap
    map.style = orvianStyle() as never
    map.load()
    await nextTick()
    await nextTick()
    return { wrapper, map, api: () => api }
  }

  it('MMapLayers, MMapBaseLayers and MMapFilter work from a panel beside the map', async () => {
    const { wrapper, map } = await mountBeside()
    const panel = wrapper.find('aside')
    expect(panel.text()).toContain('Parcels')
    await panel.find('button[aria-label="Hide layer"]').trigger('click')
    expect(map.getLayoutProperty('parcels', 'visibility')).toBe('none')
    await panel.find('button[aria-label="Satellite"]').trigger('click')
    expect(map.getLayoutProperty('sat', 'visibility')).toBe('visible')
    await panel.findAll('button').find((b) => b.text().includes('cafe'))!.trigger('click')
    expect(map.getFilter('poi')).toEqual(['in', ['get', 'kind'], ['literal', ['cafe']]])
  })

  it('useMap() takes the map too, empty until it mounts', async () => {
    const { map, api } = await mountBeside()
    expect(api().map.value).toBe(map)
  })
})

describe('identify', () => {
  it('lists the identify layers\' features under a point, formatted, minus hidden and excluded properties', async () => {
    const { map } = await mountWithLayers()
    map.rendered = [
      { layer: { id: 'parcels' }, properties: { area: 1500, owner: 'Ana', secret: 'x', gid: 7, layerId: 'parcels' } },
      { layer: { id: 'roads' }, properties: { name: 'Main St' } },
    ]
    const model = orvianAdapter()(orvianStyle() as unknown as StyleSpecification, { styleUrl: STYLE_URL })
    const results = identifyFeatures(map as never, [0, 0], model)
    expect(results).toHaveLength(1)
    expect(results[0]!.layer.title).toBe('Parcels')
    expect(results[0]!.fields).toEqual([
      { key: 'area', label: 'Area', value: '1,500.00 m²' },
      { key: 'owner', label: 'Owner', value: 'Ana' },
    ])
  })

  it('MMapIdentify emits the results of a click and opens them in a popup', async () => {
    const onIdentify = vi.fn()
    const { map } = await mountWithLayers(() => h(MMapIdentify, { onIdentify }))
    map.rendered = [{ layer: { id: 'parcels' }, properties: { owner: 'Ana' } }]
    map.fire('click', { target: map, point: { x: 1, y: 2 }, lngLat: { lng: 3, lat: 4 } })
    await nextTick()
    await nextTick()
    expect(onIdentify).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ fields: [{ key: 'owner', label: 'Owner', value: 'Ana' }] })]), [3, 4])
    const popup = created.popups.at(-1)!
    expect(popup.isOpen()).toBe(true)
    expect(popup.content?.textContent).toContain('Ana')
  })

  it('MMapIdentify ignores clicks while disabled', async () => {
    const onIdentify = vi.fn()
    const { map } = await mountWithLayers(() => h(MMapIdentify, { enabled: false, onIdentify }))
    map.fire('click', { target: map, point: { x: 1, y: 2 }, lngLat: { lng: 3, lat: 4 } })
    expect(onIdentify).not.toHaveBeenCalled()
  })
})

describe('MMapHover', () => {
  it('adds its on/off control and, while on, shows the hover fields of the feature under the pointer', async () => {
    const Host = defineComponent({
      props: { on: Boolean },
      setup: (p) => () => h(MMap, { mapStyle: STYLE_URL, adapter: orvianAdapter() }, () => h(MMapHover, { modelValue: p.on })),
    })
    const wrapper = mount(Host, { props: { on: false }, attachTo: document.body })
    await flushPromises()
    const map = created.maps.at(-1)!
    map.style = orvianStyle() as never
    map.load()
    await nextTick()
    await nextTick()
    expect(map.controls.some((c) => c.position === 'top-right')).toBe(true)
    expect(map.count('mousemove:parcels')).toBe(0)
    await wrapper.setProps({ on: true })
    expect(map.count('mousemove:parcels')).toBe(1)
    map.fire('mousemove:parcels', { features: [{ layer: { id: 'parcels' }, properties: { owner: 'Ana', area: 1500 } }], lngLat: { lng: 1, lat: 2 } })
    await nextTick()
    await nextTick()
    const popup = created.popups.at(-1)!
    expect(popup.isOpen()).toBe(true)
    expect(popup.content?.textContent).toContain('Ana')
    expect(popup.content?.textContent).toContain('1,500')
    await wrapper.setProps({ on: false })
    expect(map.count('mousemove:parcels')).toBe(0)
  })
})
