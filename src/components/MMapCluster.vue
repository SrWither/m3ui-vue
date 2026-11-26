<script setup lang="ts">
/**
 * Clustered points on an `MMap`: GeoJSON points (an object, or a URL) grouped by MapLibre's clustering into M3 count
 * bubbles that grow with their count; a click or Enter on one zooms in until it splits. The points left on their own
 * are drawn as circles in the same color (or with `pointLayers`). The bubbles are HTML (buttons you can tab to, the
 * theme's type scale, no glyphs needed in the style); `#cluster` replaces their content. Replace `data` (a new object)
 * to update it. It's added again after a style change. Available from the `/map` entry point.
 *
 * @slot cluster A bubble's content instead of the default one: `{ id, count, label, lngLat, zoomIn, leaves }`
 * @event click A click on one of its single points (MapLibre's `MapLayerMouseEvent`: `e.features` holds them)
 * @event cluster-click A click on a bubble: `{ id, count, lngLat, zoomIn, leaves }` (it zooms in by itself unless `zoomOnClick` is false)
 */
import { computed, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { useLocale } from '../composables/useLocale'
import { useThemeTokens } from '../composables/useThemeTokens'
import type { MapGeoJsonLayer } from './MMapGeoJson.vue'

/** One of the points in a cluster (a GeoJSON feature). */
export type MapClusterLeaf = Awaited<ReturnType<Maplibre.GeoJSONSource['getClusterLeaves']>>[number]

/** A bubble, as `#cluster` and `cluster-click` get it. */
export interface MapCluster {
  /** MapLibre's cluster id */
  id: number
  /** How many points it holds */
  count: number
  /** Where it sits, `[lng, lat]` */
  lngLat: [number, number]
  /** Zooms in until it splits */
  zoomIn: () => Promise<void>
  /** Its points (all of them by default, or the first `limit`) */
  leaves: (limit?: number) => Promise<MapClusterLeaf[]>
}

// It renders nothing in place: no element for attributes to land on
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** A GeoJSON object (a FeatureCollection of points), or the URL of one */
    data: Maplibre.GeoJSONSourceSpecification['data']
    /** The source's id (and the prefix of its layers' ids). Unique on the map; generated when left out */
    id?: string
    /** The theme color of the bubbles and the single points */
    color?: 'primary' | 'secondary' | 'tertiary'
    /** How close points must be to be grouped, in pixels (MapLibre's `clusterRadius`) */
    radius?: number
    /** Above this zoom nothing is grouped (MapLibre's `clusterMaxZoom`) */
    maxZoom?: number
    /** Zoom in on a bubble when it's clicked */
    zoomOnClick?: boolean
    /** How to draw the single points: MapLibre layers without `source` (filter out clusters yourself: `['!', ['has', 'point_count']]`). Defaults to a circle */
    pointLayers?: MapGeoJsonLayer[]
    /** Insert the point layers below this layer id */
    before?: string
    /** Show a pointer over the single points (set it when you handle `click`) */
    interactive?: boolean
    /** More options for the GeoJSON source (`clusterProperties`, `clusterMinPoints`, `promoteId`…) */
    sourceOptions?: Partial<Omit<Maplibre.GeoJSONSourceSpecification, 'type' | 'data' | 'cluster' | 'clusterRadius' | 'clusterMaxZoom'>>
  }>(),
  { color: 'primary', radius: 50, maxZoom: 14, zoomOnClick: true, interactive: false },
)

const emit = defineEmits<{
  click: [event: Maplibre.MapLayerMouseEvent]
  'cluster-click': [cluster: MapCluster]
}>()

const sourceId = props.id ?? `m3-cluster-${useId()}`
const locale = useLocale()
const { onReady, styleVersion } = useMap()
const theme = useThemeTokens(['primary', 'secondary', 'tertiary', 'surface'] as const)

const SINGLE: Maplibre.FilterSpecification = ['!', ['has', 'point_count']]

const layers = computed(() => {
  const color = theme.value[props.color]
  const list: MapGeoJsonLayer[] = props.pointLayers ?? [{
    type: 'circle',
    filter: SINGLE,
    paint: { 'circle-color': color, 'circle-radius': 6, 'circle-stroke-color': theme.value.surface, 'circle-stroke-width': 2 },
  }]
  return list.map((l, i) => ({ ...l, id: l.id ?? `${sourceId}-point-${i}`, source: sourceId }) as Maplibre.LayerSpecification)
})

// Static class strings, so Tailwind finds them
const COLORS = {
  primary: 'bg-primary text-on-primary after:bg-on-primary',
  secondary: 'bg-secondary text-on-secondary after:bg-on-secondary',
  tertiary: 'bg-tertiary text-on-tertiary after:bg-on-tertiary',
} as const

/** The bubble's diameter: bigger for more points. */
function sizeOf(count: number) {
  return count < 10 ? 32 : count < 100 ? 40 : count < 1000 ? 48 : 56
}

const compact = computed(() => {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 })
})

interface Bubble extends MapCluster {
  el: HTMLElement
  marker: Maplibre.Marker
}

let map: Maplibre.Map | undefined
let ml: typeof import('maplibre-gl') | undefined
let added: string[] = []
const bubbles = new Map<number, Bubble>()
const shown = shallowRef<Bubble[]>([])

const source = () => map?.getSource(sourceId) as Maplibre.GeoJSONSource | undefined

function makeCluster(id: number, count: number, lngLat: [number, number]): MapCluster {
  return {
    id,
    count,
    lngLat,
    zoomIn: async () => {
      const zoom = await source()?.getClusterExpansionZoom(id)
      if (zoom === undefined || !map) return
      map.easeTo({ center: lngLat, zoom: Math.min(zoom, map.getMaxZoom()) })
    },
    leaves: async (limit = Infinity) => (await source()?.getClusterLeaves(id, limit, 0)) ?? [],
  }
}

/** Matches the bubbles to the clusters MapLibre has now. */
function update() {
  frame = 0
  if (!map || !ml || !map.getSource(sourceId)) return
  const seen = new Set<number>()
  for (const f of map.querySourceFeatures(sourceId, { filter: ['has', 'point_count'] })) {
    const p = f.properties as { cluster_id: number; point_count: number }
    const id = p.cluster_id
    if (seen.has(id)) continue // a cluster crossing tiles comes back once per tile
    seen.add(id)
    const [lng, lat] = (f.geometry as { coordinates: number[] }).coordinates as [number, number]
    const old = bubbles.get(id)
    if (old && old.count === p.point_count) {
      old.marker.setLngLat([lng, lat])
      continue
    }
    old?.marker.remove()
    const el = old?.el ?? document.createElement('div')
    el.className = 'm3-map-cluster'
    const marker = new ml.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
    bubbles.set(id, { ...makeCluster(id, p.point_count, [lng, lat]), el, marker })
  }
  for (const [id, b] of bubbles) {
    if (seen.has(id)) continue
    b.marker.remove()
    bubbles.delete(id)
  }
  shown.value = [...bubbles.values()]
}

let frame = 0
function schedule() {
  if (!frame) frame = requestAnimationFrame(update)
}
const onSourceData = (e: Maplibre.MapSourceDataEvent) => {
  if (e.sourceId === sourceId) schedule()
}

const onClick = (e: Maplibre.MapLayerMouseEvent) => emit('click', e)
const onEnter = () => { if (props.interactive && map) map.getCanvas().style.cursor = 'pointer' }
const onLeave = () => { if (props.interactive && map) map.getCanvas().style.cursor = '' }

function removeLayers() {
  if (!map) return
  for (const id of added) {
    map.off('click', id, onClick)
    map.off('mouseenter', id, onEnter)
    map.off('mouseleave', id, onLeave)
    if (map.getLayer(id)) map.removeLayer(id)
  }
  added = []
}

function addLayers() {
  if (!map) return
  removeLayers()
  for (const layer of layers.value) {
    map.addLayer(layer, props.before && map.getLayer(props.before) ? props.before : undefined)
    map.on('click', layer.id, onClick)
    map.on('mouseenter', layer.id, onEnter)
    map.on('mouseleave', layer.id, onLeave)
    added.push(layer.id)
  }
}

function sourceSpec(): Maplibre.GeoJSONSourceSpecification {
  return { type: 'geojson', data: props.data, ...props.sourceOptions, cluster: true, clusterRadius: props.radius, clusterMaxZoom: props.maxZoom }
}

/** The source and its layers, unless they're there already (a style change drops them). */
function add() {
  if (!map) return
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, sourceSpec())
    added = []
  }
  if (!added.length || !map.getLayer(added[0]!)) addLayers()
  schedule()
}

/** Clustering options can't change on a live source: add it again. */
function rebuild() {
  if (!map) return
  removeLayers()
  if (map.getSource(sourceId)) map.removeSource(sourceId)
  add()
}

onReady((m, lib) => {
  map = m
  ml = lib
  add()
  map.on('sourcedata', onSourceData)
  map.on('move', schedule)
  map.on('moveend', schedule)
})

watch(styleVersion, () => add())
watch(() => props.data, (data) => {
  source()?.setData(data)
  schedule()
})
watch(() => [props.radius, props.maxZoom, JSON.stringify(props.sourceOptions)].join('|'), rebuild)
// Layers by value: an inline `:point-layers="[...]"` is a new array on every parent render
watch(() => JSON.stringify(layers.value), () => addLayers())
watch(() => props.before, () => addLayers())

function onBubbleClick(b: Bubble) {
  const cluster: MapCluster = { id: b.id, count: b.count, lngLat: b.lngLat, zoomIn: b.zoomIn, leaves: b.leaves }
  emit('cluster-click', cluster)
  if (props.zoomOnClick) void b.zoomIn()
}

const labelOf = (count: number) => locale.mapClusterZoom.replace('{count}', String(count))

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  for (const b of bubbles.values()) b.marker.remove()
  bubbles.clear()
  shown.value = []
  if (!map) return
  map.off('sourcedata', onSourceData)
  map.off('move', schedule)
  map.off('moveend', schedule)
  removeLayers()
  if (map.getSource(sourceId)) map.removeSource(sourceId)
  map = undefined
})

defineExpose({
  /** The source's id */
  sourceId,
  /** The ids of its point layers on the map */
  layerIds: () => [...added],
  /** The bubbles on screen now */
  clusters: (): MapCluster[] => shown.value.map(({ id, count, lngLat, zoomIn, leaves }) => ({ id, count, lngLat, zoomIn, leaves })),
})
</script>

<!-- Each bubble is rendered into its MapLibre marker's element -->
<template>
  <Teleport v-for="b in shown" :key="b.id" :to="b.el">
    <slot
      name="cluster"
      :id="b.id"
      :count="b.count"
      :label="compact.format(b.count)"
      :lng-lat="b.lngLat"
      :zoom-in="b.zoomIn"
      :leaves="b.leaves"
    >
      <button
        type="button"
        class="m3-map-cluster__bubble relative grid cursor-pointer place-items-center rounded-full border-2 border-surface text-label-large font-medium shadow-elevation-1 outline-none transition-[transform,box-shadow] duration-150 after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:opacity-0 after:transition-opacity hover:shadow-elevation-2 hover:after:opacity-8 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-secondary active:after:opacity-10"
        :class="COLORS[color]"
        :style="{ width: `${sizeOf(b.count)}px`, height: `${sizeOf(b.count)}px` }"
        :aria-label="labelOf(b.count)"
        @click.stop="onBubbleClick(b)"
      >
        {{ compact.format(b.count) }}
      </button>
    </slot>
  </Teleport>
</template>
