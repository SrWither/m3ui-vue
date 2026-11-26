import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { created, type FakeMap } from './_fakeMaplibre'

vi.mock('maplibre-gl', async () => (await import('./_fakeMaplibre')).fakeModule)

const { MMap, MMapCluster } = await import('../map')

const points = {
  type: 'FeatureCollection',
  features: [[-64.18, -31.42], [-64.19, -31.41], [-64.2, -31.43]].map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })),
}
const cluster = (id: number, count: number, at: [number, number]) => ({
  properties: { cluster: true, cluster_id: id, point_count: count },
  geometry: { type: 'Point', coordinates: at },
})
// The fake map doesn't put marker elements in the page: look inside the live markers
const live = () => created.markers.filter((m) => m.map).map((m) => m.element)
const inBubbles = <T extends Element = HTMLElement>(sel: string) => live().flatMap((el) => [...el.querySelectorAll<T>(sel)])
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

beforeEach(() => {
  created.maps = []
  created.markers = []
  created.popups = []
  document.documentElement.lang = 'en'
})
afterEach(() => { document.body.innerHTML = '' })

async function mountCluster(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  const events: { cluster: unknown[]; click: unknown[] } = { cluster: [], click: [] }
  const wrapper = mount(MMap, {
    props: { mapStyle: 'https://x.test/style.json' },
    slots: {
      default: () => h(MMapCluster, {
        data: points, id: 'spots', ...props,
        onClusterClick: (c: unknown) => events.cluster.push(c),
        onClick: (e: unknown) => events.click.push(e),
      }, slots),
    },
    attachTo: document.body,
  })
  await flushPromises()
  const map = created.maps.at(-1)! as FakeMap
  map.load()
  await nextTick()
  await nextTick()
  return { wrapper, map, events }
}

async function showClusters(map: FakeMap, features: ReturnType<typeof cluster>[]) {
  map.sourceFeatures = features
  map.fire('moveend')
  await frame()
  await nextTick()
}

describe('MMapCluster', () => {
  it('adds a clustered source and a circle layer for the single points', async () => {
    const { map } = await mountCluster({ radius: 60, maxZoom: 12 })
    expect(map.sources.get('spots')!.spec).toMatchObject({ type: 'geojson', data: points, cluster: true, clusterRadius: 60, clusterMaxZoom: 12 })
    const layer = map.layers.find((l) => l.id === 'spots-point-0')!
    expect(layer).toMatchObject({ type: 'circle', source: 'spots', filter: ['!', ['has', 'point_count']] })
  })

  it('shows one bubble per cluster, sized by count, deduplicated across tiles', async () => {
    const { map } = await mountCluster()
    await showClusters(map, [cluster(1, 3, [-64.19, -31.42]), cluster(1, 3, [-64.19, -31.42]), cluster(2, 1500, [-64.3, -31.5])])
    const buttons = inBubbles<HTMLButtonElement>('button')
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['3', '1.5K'])
    expect(buttons[0]!.getAttribute('aria-label')).toBe('3 places, zoom in')
    expect(buttons[0]!.style.width).toBe('32px')
    expect(buttons[1]!.style.width).toBe('56px')
    expect(buttons[0]!.className).toContain('bg-primary')
    expect(live()).toHaveLength(2)
  })

  it('removes bubbles for clusters that are gone', async () => {
    const { map } = await mountCluster()
    await showClusters(map, [cluster(1, 3, [-64.19, -31.42]), cluster(2, 4, [-64.3, -31.5])])
    await showClusters(map, [cluster(2, 4, [-64.3, -31.5])])
    expect(inBubbles('button')).toHaveLength(1)
    expect(live()).toHaveLength(1)
  })

  it('zooms in on click, emitting cluster-click', async () => {
    const { map, events } = await mountCluster()
    await showClusters(map, [cluster(7, 5, [-64.19, -31.42])])
    inBubbles<HTMLButtonElement>('button')[0]!.click()
    await flushPromises()
    expect(events.cluster).toHaveLength(1)
    expect(events.cluster[0]).toMatchObject({ id: 7, count: 5, lngLat: [-64.19, -31.42] })
    expect(map.flights).toContainEqual(['easeTo', { center: [-64.19, -31.42], zoom: 9 }])
  })

  it('leaves zooming to the consumer with zoomOnClick false, and gives the points', async () => {
    const { map, events } = await mountCluster({ zoomOnClick: false })
    map.sources.get('spots')!.leaves = points.features
    await showClusters(map, [cluster(7, 3, [-64.19, -31.42])])
    inBubbles<HTMLButtonElement>('button')[0]!.click()
    await flushPromises()
    expect(map.flights).toEqual([])
    const leaves = await (events.cluster[0] as { leaves: (n?: number) => Promise<unknown[]> }).leaves(2)
    expect(leaves).toHaveLength(2)
  })

  it('takes a #cluster slot and a color', async () => {
    const { map } = await mountCluster({ color: 'tertiary' }, {
      cluster: ({ count, label }: { count: number; label: string }) => h('span', { class: 'mine' }, `${label}/${count}`),
    })
    await showClusters(map, [cluster(1, 2500, [-64.19, -31.42])])
    expect(inBubbles('.mine')[0]!.textContent).toBe('2.5K/2500')
    expect(inBubbles('button')).toEqual([])
    expect(live()[0]!.className).toBe('m3-map-cluster')
  })

  it('cleans up its source, layers and bubbles on unmount', async () => {
    const { wrapper, map } = await mountCluster()
    await showClusters(map, [cluster(1, 3, [-64.19, -31.42])])
    expect(live()).toHaveLength(1)
    wrapper.unmount()
    expect(map.sources.has('spots')).toBe(false)
    expect(map.layers.find((l) => l.id === 'spots-point-0')).toBeUndefined()
    expect(live()).toHaveLength(0)
  })
})
