<script setup lang="ts">
/**
 * GeoJSON on an `MMap`: a source from `data` (an object, or a URL MapLibre fetches) drawn with `layers`. Without
 * `layers` it draws every geometry in the theme's primary, following palette and dark mode: polygons filled with an
 * outline, lines, and points as circles. Replace `data` (a new object) to update it. It's added again after a style
 * change. Available from the `/map` entry point.
 *
 * @event click A click on one of its features (MapLibre's `MapLayerMouseEvent`: `e.features` holds them)
 */
import { computed, onBeforeUnmount, useId, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { useThemeTokens } from '../composables/useThemeTokens'

// Omit over each member of the union (a plain Omit keeps only what all layer types share, losing paint and layout)
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** A layer of `MMapGeoJson`: any MapLibre layer without its `source` (and `id`, made up when left out). */
export type MapGeoJsonLayer = DistributiveOmit<Exclude<Maplibre.LayerSpecification, Maplibre.BackgroundLayerSpecification>, 'id' | 'source'> & { id?: string }

// It renders nothing: no element for attributes to land on
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** A GeoJSON object, or the URL of one */
    data: Maplibre.GeoJSONSourceSpecification['data']
    /** The source's id (and the prefix of its layers' made-up ids). Unique on the map; generated when left out */
    id?: string
    /** How to draw it: MapLibre layers without `source`. Defaults to theme-colored fill, outline, line and circle layers */
    layers?: MapGeoJsonLayer[]
    /** Insert the layers below this layer id (e.g. under the style's labels) */
    before?: string
    /** Show a pointer over its features (set it when you handle `click`) */
    interactive?: boolean
    /** More options for the GeoJSON source (`cluster`, `promoteId`, `tolerance`…) */
    sourceOptions?: Partial<Omit<Maplibre.GeoJSONSourceSpecification, 'type' | 'data'>>
  }>(),
  { interactive: false },
)

const emit = defineEmits<{ click: [event: Maplibre.MapLayerMouseEvent] }>()

const sourceId = props.id ?? `m3-geojson-${useId()}`
const { onReady, styleVersion } = useMap()
const theme = useThemeTokens(['primary', 'surface'] as const)

const is = (...types: string[]): Maplibre.FilterSpecification => ['match', ['geometry-type'], types, true, false]

/** The theme-colored default layers. */
const defaultLayers = computed<MapGeoJsonLayer[]>(() => {
  const { primary, surface } = theme.value
  return [
    { id: `${sourceId}-fill`, type: 'fill', filter: is('Polygon', 'MultiPolygon'), paint: { 'fill-color': primary, 'fill-opacity': 0.24 } },
    { id: `${sourceId}-line`, type: 'line', filter: is('Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'), paint: { 'line-color': primary, 'line-width': 2 } },
    {
      id: `${sourceId}-circle`,
      type: 'circle',
      filter: is('Point', 'MultiPoint'),
      paint: { 'circle-color': primary, 'circle-radius': 6, 'circle-stroke-color': surface, 'circle-stroke-width': 2 },
    },
  ]
})

const layers = computed(() =>
  (props.layers ?? defaultLayers.value).map((l, i) => ({ ...l, id: l.id ?? `${sourceId}-${i}`, source: sourceId }) as Maplibre.LayerSpecification),
)

let map: Maplibre.Map | undefined
let added: string[] = []

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

/** The source and its layers, unless they're there already (a style change drops them). */
function add() {
  if (!map) return
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: props.data, ...props.sourceOptions })
    added = []
  }
  if (!added.length || !map.getLayer(added[0]!)) addLayers()
}

onReady((m) => {
  map = m
  add()
})

watch(styleVersion, () => add())
watch(() => props.data, (data) => (map?.getSource(sourceId) as Maplibre.GeoJSONSource | undefined)?.setData(data))
// Layers by value: an inline `:layers="[...]"` is a new array on every parent render
watch(() => JSON.stringify(layers.value), () => addLayers())
watch(() => props.before, () => addLayers())

onBeforeUnmount(() => {
  if (!map) return
  removeLayers()
  if (map.getSource(sourceId)) map.removeSource(sourceId)
  map = undefined
})

defineExpose({
  /** The source's id */
  sourceId,
  /** The ids of its layers on the map */
  layerIds: () => [...added],
})
</script>

<!-- Nothing of its own: it draws on the map -->
<template></template>
