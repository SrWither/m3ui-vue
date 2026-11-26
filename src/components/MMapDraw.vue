<script setup lang="ts">
/**
 * Drawing and editing points, lines and polygons on an `MMap`, as GeoJSON (v-model: a FeatureCollection), with its
 * own control (point, line, polygon, delete). To draw: click to add points (a preview follows the pointer), then
 * double-click, Enter or Escape to finish, or click the first point to close a polygon; Backspace takes back the last
 * point. A point is placed with one click. To edit: click a shape to select it, then drag a vertex, drag a midpoint to
 * add one, double-click a vertex to remove it, or press Delete (or the control's button) to delete the shape. Escape
 * or a click on empty map deselects. Everything follows the theme. While drawing or dragging it owns the map's clicks
 * (`MMapIdentify` waits). Features keep their `properties`; ones without an `id` get one. Multi-geometries are shown
 * and can be selected and deleted, not reshaped. Available from the `/map` entry point.
 *
 * @event update:modelValue The shapes changed (drawn, edited, deleted): the whole FeatureCollection
 * @event update:mode The drawing mode changed (`'point'`, `'line'`, `'polygon'`, or null when it finished)
 * @event select A shape was selected (its feature), or the selection was cleared (null)
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MIcon from './MIcon.vue'
import MMapControl from './MMapControl.vue'
import { useLocale } from '../composables/useLocale'
import { useMap } from '../composables/useMap'
import { useThemeTokens } from '../composables/useThemeTokens'
import { useEscapeStack } from '../composables/_useEscapeStack'
import { midpoint, type LngLat } from '../composables/_mapGeometry'
import type { MapControlPosition } from './MMap.vue'

/** What `MMapDraw` draws. */
export type MapDrawMode = 'point' | 'line' | 'polygon'

type Geometry =
  | { type: 'Point'; coordinates: LngLat }
  | { type: 'LineString'; coordinates: LngLat[] }
  | { type: 'Polygon'; coordinates: LngLat[][] }
  | { type: 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection'; [key: string]: unknown }

/** A shape of `MMapDraw` (a GeoJSON feature). */
export interface MapDrawFeature {
  type: 'Feature'
  id?: string | number
  geometry: Geometry
  properties: Record<string, unknown> | null
}

/** `MMapDraw`'s v-model. */
export interface MapDrawCollection {
  type: 'FeatureCollection'
  features: MapDrawFeature[]
}

const props = withDefaults(
  defineProps<{
    /** The shapes (v-model) */
    modelValue?: MapDrawCollection
    /** The drawing mode (v-model:mode): `'point'`, `'line'`, `'polygon'`, or null. Set it to start drawing from outside */
    mode?: MapDrawMode | null
    /** Which shapes its control offers, in order */
    modes?: MapDrawMode[]
    /** Its buttons: `false` (drive it with v-model:mode), or a corner (`true` is top-right) */
    control?: boolean | MapControlPosition
    /** The theme color of the shapes */
    color?: 'primary' | 'secondary' | 'tertiary'
    /** Let the user select, reshape and delete shapes (false: draw only) */
    editable?: boolean
  }>(),
  { mode: null, modes: () => ['point', 'line', 'polygon'], control: true, color: 'primary', editable: true },
)

const emit = defineEmits<{
  'update:modelValue': [collection: MapDrawCollection]
  'update:mode': [mode: MapDrawMode | null]
  select: [feature: MapDrawFeature | null]
}>()

const t = useLocale()
const { onReady, styleVersion, activeTool } = useMap()
const theme = useThemeTokens(['primary', 'secondary', 'tertiary', 'surface'] as const)

const uid = `m3-draw-${useId()}`
const SRC = { shapes: `${uid}-shapes`, draft: `${uid}-draft`, handles: `${uid}-handles` }
const SHAPE_LAYERS = [`${SRC.shapes}-fill`, `${SRC.shapes}-line`, `${SRC.shapes}-point`]
const VERTEX = `${SRC.handles}-vertex`
const MIDPOINT = `${SRC.handles}-midpoint`
const TOOL = 'draw'
/** How far from a shape a click still selects it, in pixels */
const HIT = 6

// Plain state, stepped on every pointer move: only the mode and the selection are reactive
let features: MapDrawFeature[] = []
let lastEmitted = ''
let nextId = 1
let draft: LngLat[] = []
let cursor: LngLat | null = null
let drag: { id: string | number; v: number; moved: boolean } | null = null
let raf = 0
let map: Maplibre.Map | undefined

const mode = ref<MapDrawMode | null>(null)
const selected = ref<string | number | null>(null)

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const byId = (id: string | number | null) => (id === null ? undefined : features.find((f) => f.id === id))

/** Takes the v-model in, giving an id to features without one. */
function load(collection: MapDrawCollection | undefined) {
  features = clone(collection?.features ?? [])
  for (const f of features) {
    if (f.id === undefined || f.id === null) f.id = nextFeatureId()
  }
  if (selected.value !== null && !byId(selected.value)) selected.value = null
}

function commit() {
  const collection: MapDrawCollection = { type: 'FeatureCollection', features: clone(features) }
  lastEmitted = JSON.stringify(collection.features)
  emit('update:modelValue', collection)
}

// ── Geometry access ────────────────────────────────────────────────────────────────────────────

/** The editable vertices of a shape (a polygon's outer ring without its closing point), or null. */
function verticesOf(f: MapDrawFeature): LngLat[] | null {
  const g = f.geometry
  if (g.type === 'Point') return [g.coordinates as LngLat]
  if (g.type === 'LineString') return g.coordinates as LngLat[]
  if (g.type === 'Polygon') return ((g.coordinates as LngLat[][])[0] ?? []).slice(0, -1)
  return null
}

function setVertices(f: MapDrawFeature, vertices: LngLat[]) {
  const g = f.geometry
  if (g.type === 'Point') g.coordinates = vertices[0]!
  else if (g.type === 'LineString') g.coordinates = vertices
  else if (g.type === 'Polygon') {
    const rings = g.coordinates as LngLat[][]
    rings[0] = [...vertices, [...vertices[0]!] as LngLat]
  }
}

const minVertices = (f: MapDrawFeature) => (f.geometry.type === 'Polygon' ? 3 : f.geometry.type === 'LineString' ? 2 : 1)

// ── Rendering ──────────────────────────────────────────────────────────────────────────────────

type Shape = { type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }
const point = (p: LngLat, properties: Record<string, unknown> = {}): Shape => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties })
const collection = (list: Shape[]) => ({ type: 'FeatureCollection' as const, features: list })
const setData = (source: string, list: Shape[]) => (map?.getSource(source) as Maplibre.GeoJSONSource | undefined)?.setData(collection(list) as never)

function render() {
  if (!map) return
  setData(SRC.shapes, features.map((f) => ({
    type: 'Feature',
    geometry: f.geometry,
    // Internal keys for the layers: which shape it is, and whether it's the selected one
    properties: { ...f.properties, __draw_id: String(f.id), __draw_selected: f.id === selected.value },
  })))

  const preview: Shape[] = []
  if (mode.value && mode.value !== 'point' && draft.length) {
    const path = cursor ? [...draft, cursor] : draft
    draft.forEach((p) => preview.push(point(p)))
    if (path.length >= 2) preview.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: mode.value === 'polygon' && path.length >= 3 ? [...path, path[0]] : path }, properties: {} })
    if (mode.value === 'polygon' && path.length >= 3) preview.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...path, path[0]]] }, properties: {} })
  }
  setData(SRC.draft, preview)

  const handles: Shape[] = []
  const f = byId(selected.value)
  const vertices = f && !mode.value && props.editable ? verticesOf(f) : null
  if (f && vertices) {
    vertices.forEach((p, v) => handles.push(point(p, { handle: 'vertex', v })))
    if (f.geometry.type !== 'Point') {
      const path = f.geometry.type === 'Polygon' ? [...vertices, vertices[0]!] : vertices
      for (let i = 0; i < path.length - 1; i++) handles.push(point(midpoint(path[i]!, path[i + 1]!), { handle: 'midpoint', after: i }))
    }
  }
  setData(SRC.handles, handles)
}

function scheduleRender() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    render()
  })
}

// ── Layers ─────────────────────────────────────────────────────────────────────────────────────

const is = (...types: string[]): Maplibre.FilterSpecification => ['match', ['geometry-type'], types, true, false]
const SEL: Maplibre.ExpressionSpecification = ['==', ['get', '__draw_selected'], true]

function paints() {
  const color = theme.value[props.color]
  const surface = theme.value.surface
  return {
    fill: { 'fill-color': color, 'fill-opacity': ['case', SEL, 0.3, 0.18] },
    line: { 'line-color': color, 'line-width': ['case', SEL, 4, 2.5] },
    point: { 'circle-color': color, 'circle-radius': ['case', SEL, 8, 6], 'circle-stroke-color': surface, 'circle-stroke-width': 2 },
    draftFill: { 'fill-color': color, 'fill-opacity': 0.12 },
    draftLine: { 'line-color': color },
    handle: { 'circle-color': surface, 'circle-stroke-color': color },
  }
}

function ensureLayers() {
  if (!map) return
  for (const source of Object.values(SRC)) {
    if (!map.getSource(source)) map.addSource(source, { type: 'geojson', data: collection([]) as never })
  }
  const p = paints()
  const add = (layer: Record<string, unknown>) => { if (!map!.getLayer(layer.id as string)) map!.addLayer(layer as Maplibre.LayerSpecification) }
  add({ id: SHAPE_LAYERS[0], type: 'fill', source: SRC.shapes, filter: is('Polygon', 'MultiPolygon'), paint: p.fill })
  add({ id: SHAPE_LAYERS[1], type: 'line', source: SRC.shapes, filter: is('LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'), paint: p.line })
  add({ id: SHAPE_LAYERS[2], type: 'circle', source: SRC.shapes, filter: is('Point', 'MultiPoint'), paint: p.point })
  add({ id: `${SRC.draft}-fill`, type: 'fill', source: SRC.draft, filter: is('Polygon'), paint: p.draftFill })
  add({ id: `${SRC.draft}-line`, type: 'line', source: SRC.draft, filter: is('LineString'), paint: { ...p.draftLine, 'line-width': 2.5, 'line-dasharray': [2, 2] } })
  add({ id: `${SRC.draft}-point`, type: 'circle', source: SRC.draft, filter: is('Point'), paint: { ...p.handle, 'circle-radius': 5, 'circle-stroke-width': 2 } })
  add({ id: MIDPOINT, type: 'circle', source: SRC.handles, filter: ['==', ['get', 'handle'], 'midpoint'], paint: { ...p.handle, 'circle-radius': 4, 'circle-stroke-width': 1.5, 'circle-opacity': 0.7 } })
  add({ id: VERTEX, type: 'circle', source: SRC.handles, filter: ['==', ['get', 'handle'], 'vertex'], paint: { ...p.handle, 'circle-radius': 7, 'circle-stroke-width': 2.5 } })
}

type SetPaint = Parameters<Maplibre.Map['setPaintProperty']>
watch([theme, () => props.color], () => {
  if (!map) return
  const p = paints()
  const set = (layer: string, paint: Record<string, unknown>) => {
    if (map!.getLayer(layer)) for (const [k, v] of Object.entries(paint)) map!.setPaintProperty(layer, k as SetPaint[1], v as SetPaint[2])
  }
  set(SHAPE_LAYERS[0]!, p.fill)
  set(SHAPE_LAYERS[1]!, p.line)
  set(SHAPE_LAYERS[2]!, p.point)
  set(`${SRC.draft}-fill`, p.draftFill)
  set(`${SRC.draft}-line`, p.draftLine)
  set(`${SRC.draft}-point`, p.handle)
  set(MIDPOINT, p.handle)
  set(VERTEX, p.handle)
})

// ── Selecting ──────────────────────────────────────────────────────────────────────────────────

function select(id: string | number | null) {
  if (id !== null && !byId(id)) id = null
  if (selected.value === id) return
  selected.value = id
  render()
  const f = byId(id)
  emit('select', f ? clone(f) : null)
}

/** Deletes a shape (the selected one by default). */
function remove(id: string | number | null = selected.value) {
  const i = features.findIndex((f) => f.id === id)
  if (i < 0) return
  features.splice(i, 1)
  if (selected.value === id) {
    selected.value = null
    emit('select', null)
  }
  render()
  commit()
}

/** Deletes every shape. */
function clear() {
  if (mode.value) finish()
  if (!features.length) return
  features = []
  if (selected.value !== null) {
    selected.value = null
    emit('select', null)
  }
  render()
  commit()
}

type LayerEvent = (Maplibre.MapMouseEvent | Maplibre.MapTouchEvent) & { features?: Maplibre.MapGeoJSONFeature[] }

const lngLatOf = (e: { lngLat: { lng: number; lat: number } }): LngLat => [e.lngLat.lng, e.lngLat.lat]

/** A click on the map while not drawing: selects the shape under it, or clears the selection. */
function onMapClick(e: Maplibre.MapMouseEvent) {
  if (mode.value || !map || !props.editable) return
  if (activeTool.value && activeTool.value !== TOOL) return
  // A few pixels around the click, or a thin line is almost impossible to hit
  const { x, y } = e.point
  const box: [Maplibre.PointLike, Maplibre.PointLike] = [[x - HIT, y - HIT], [x + HIT, y + HIT]]
  const hit = map.queryRenderedFeatures(box, { layers: SHAPE_LAYERS.filter((l) => map!.getLayer(l)) })[0]
  const id = hit?.properties?.__draw_id as string | undefined
  if (id === undefined) return select(null)
  const f = features.find((x) => String(x.id) === id)
  select(f ? f.id! : null)
}

// Pressing a shape takes the click from MMapIdentify (it reads activeTool on click)
function onShapeDown() {
  if (mode.value || !props.editable || activeTool.value) return
  activeTool.value = TOOL
  setTimeout(() => { if (activeTool.value === TOOL && !mode.value && !drag) activeTool.value = null }, 0)
}
const onShapeEnter = () => { if (map && !mode.value && !drag && props.editable) map.getCanvas().style.cursor = 'pointer' }
const onShapeLeave = () => { if (map && !mode.value && !drag) map.getCanvas().style.cursor = '' }

// ── Drawing ────────────────────────────────────────────────────────────────────────────────────

function onDrawClick(e: Maplibre.MapMouseEvent) {
  if (!mode.value || !map) return
  if (mode.value === 'point') {
    add({ type: 'Point', coordinates: lngLatOf(e) })
    finish()
    return
  }
  if (mode.value === 'polygon' && draft.length >= 3) {
    const first = map.project(draft[0]!)
    if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 20) return finish()
  }
  draft.push(lngLatOf(e))
  render()
}

function onDrawMove(e: Maplibre.MapMouseEvent) {
  cursor = lngLatOf(e)
  scheduleRender()
}

function onDrawDblClick(e: Maplibre.MapMouseEvent) {
  e.preventDefault()
  if (!map || draft.length < 2) return
  // The double click's first click added a point on top of the last one
  const a = map.project(draft[draft.length - 1]!)
  const b = map.project(draft[draft.length - 2]!)
  if (Math.hypot(a.x - b.x, a.y - b.y) < 10) draft.pop()
  finish()
}

/** Keys are ours only with the focus on the map (or nowhere in particular), never in a field or another control. */
function keysAreOurs() {
  const active = document.activeElement
  if (!active || active === document.body) return true
  if (!map?.getContainer().contains(active)) return false
  return !(active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)))
}

function onKey(e: KeyboardEvent) {
  if (!keysAreOurs()) return
  if (mode.value) {
    if (e.key === 'Enter') {
      // Kept from a focused control button too, which would start drawing again
      e.preventDefault()
      finish()
    } else if (e.key === 'Backspace' && draft.length) {
      e.preventDefault()
      draft.pop()
      render()
    }
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value !== null && props.editable) {
    e.preventDefault()
    remove()
  }
}
// Escape finishes a drawing, else clears the selection; through the library's stack, so a map in a dialog stays open
useEscapeStack(() => !!mode.value || selected.value !== null, () => (mode.value ? finish() : select(null)))

/** A new id no shape has yet. */
function nextFeatureId() {
  let id = `shape-${nextId++}`
  while (features.some((f) => f.id === id)) id = `shape-${nextId++}`
  return id
}
function add(geometry: Geometry) {
  const f: MapDrawFeature = { type: 'Feature', id: nextFeatureId(), geometry, properties: {} }
  features.push(f)
  selected.value = props.editable ? f.id! : null
  commit()
  if (props.editable) emit('select', clone(f))
}

function start(next: MapDrawMode) {
  if (!map) return
  if (mode.value === next) return finish()
  if (mode.value) finish()
  if (selected.value !== null) select(null)
  mode.value = next
  activeTool.value = TOOL
  draft = []
  cursor = null
  map.getCanvas().style.cursor = 'crosshair'
  map.doubleClickZoom.disable()
  map.on('click', onDrawClick)
  map.on('mousemove', onDrawMove)
  map.on('dblclick', onDrawDblClick)
  render()
  if (props.mode !== next) emit('update:mode', next)
}

/** Ends drawing, keeping the shape when it has enough points. */
function finish() {
  if (!map || !mode.value) return
  cancelAnimationFrame(raf)
  raf = 0
  const drawn = mode.value
  const points = draft
  draft = []
  cursor = null
  mode.value = null
  if (activeTool.value === TOOL) activeTool.value = null
  map.getCanvas().style.cursor = ''
  map.doubleClickZoom.enable()
  map.off('click', onDrawClick)
  map.off('mousemove', onDrawMove)
  map.off('dblclick', onDrawDblClick)
  if (drawn === 'line' && points.length >= 2) add({ type: 'LineString', coordinates: points })
  else if (drawn === 'polygon' && points.length >= 3) add({ type: 'Polygon', coordinates: [[...points, [...points[0]!] as LngLat]] })
  render()
  if (props.mode !== null) emit('update:mode', null)
}

// ── Editing ────────────────────────────────────────────────────────────────────────────────────

function onHandleDown(e: LayerEvent) {
  const h = e.features?.[0]
  const f = byId(selected.value)
  if (!h || !f || mode.value || !map || !props.editable) return
  const vertices = verticesOf(f)
  if (!vertices) return
  e.preventDefault()
  let v = h.properties.v as number
  if (h.properties.handle === 'midpoint') {
    v = (h.properties.after as number) + 1
    vertices.splice(v, 0, lngLatOf(e))
    setVertices(f, vertices)
  }
  drag = { id: f.id!, v, moved: h.properties.handle === 'midpoint' }
  activeTool.value = TOOL
  map.getCanvas().style.cursor = 'grabbing'
  const touch = e.type === 'touchstart'
  if (touch) map.dragPan.disable()
  map.on(touch ? 'touchmove' : 'mousemove', onDragMove)
  map.once(touch ? 'touchend' : 'mouseup', onDragEnd)
  render()
}

function onDragMove(e: Maplibre.MapMouseEvent | Maplibre.MapTouchEvent) {
  const f = drag && byId(drag.id)
  const vertices = f && verticesOf(f)
  if (!drag || !f || !vertices) return
  vertices[drag.v] = lngLatOf(e)
  setVertices(f, vertices)
  drag.moved = true
  scheduleRender()
}

function onDragEnd() {
  if (!map) return
  const moved = drag?.moved
  drag = null
  map.off('mousemove', onDragMove)
  map.off('touchmove', onDragMove)
  map.dragPan.enable()
  map.getCanvas().style.cursor = ''
  render()
  if (moved) commit()
  // The click that ends a press comes after mouseup: keep it from MMapIdentify and from deselecting
  setTimeout(() => { if (activeTool.value === TOOL && !mode.value) activeTool.value = null })
}

function onVertexDblClick(e: LayerEvent) {
  const h = e.features?.[0]
  const f = byId(selected.value)
  if (!h || !f || mode.value || !props.editable) return
  e.preventDefault()
  const vertices = verticesOf(f)
  if (!vertices || vertices.length <= minVertices(f)) return
  vertices.splice(h.properties.v as number, 1)
  setVertices(f, vertices)
  render()
  commit()
}

const onHandleEnter = () => { if (map && !drag && !mode.value) map.getCanvas().style.cursor = 'grab' }
const onHandleLeave = () => { if (map && !drag && !mode.value) map.getCanvas().style.cursor = '' }

// ── Wiring ─────────────────────────────────────────────────────────────────────────────────────

load(props.modelValue)
lastEmitted = JSON.stringify(features)

onReady((m) => {
  map = m
  ensureLayers()
  render()
  m.on('click', onMapClick)
  for (const layer of SHAPE_LAYERS) {
    m.on('mousedown', layer, onShapeDown)
    m.on('touchstart', layer, onShapeDown)
    m.on('mouseenter', layer, onShapeEnter)
    m.on('mouseleave', layer, onShapeLeave)
  }
  for (const layer of [VERTEX, MIDPOINT]) {
    m.on('mousedown', layer, onHandleDown)
    m.on('touchstart', layer, onHandleDown)
    m.on('mouseenter', layer, onHandleEnter)
    m.on('mouseleave', layer, onHandleLeave)
  }
  m.on('dblclick', VERTEX, onVertexDblClick)
  document.addEventListener('keydown', onKey)
  if (props.mode) start(props.mode)
})

watch(styleVersion, () => {
  ensureLayers()
  render()
})
// Only a change from outside reloads (our own emits come back as the same shapes)
watch(() => props.modelValue, (next) => {
  if (JSON.stringify(next?.features ?? []) === lastEmitted) return
  load(next)
  lastEmitted = JSON.stringify(features)
  render()
}, { deep: true })
watch(() => props.mode, (next) => {
  if (next && next !== mode.value) start(next)
  else if (!next && mode.value) finish()
})
watch(() => props.editable, (editable) => {
  if (!editable && selected.value !== null) select(null)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (!map) return
  if (mode.value) finish()
  cancelAnimationFrame(raf)
  map.off('click', onMapClick)
  for (const layer of SHAPE_LAYERS) {
    map.off('mousedown', layer, onShapeDown)
    map.off('touchstart', layer, onShapeDown)
    map.off('mouseenter', layer, onShapeEnter)
    map.off('mouseleave', layer, onShapeLeave)
  }
  for (const layer of [VERTEX, MIDPOINT]) {
    map.off('mousedown', layer, onHandleDown)
    map.off('touchstart', layer, onHandleDown)
    map.off('mouseenter', layer, onHandleEnter)
    map.off('mouseleave', layer, onHandleLeave)
  }
  map.off('dblclick', VERTEX, onVertexDblClick)
  const layers = [VERTEX, MIDPOINT, `${SRC.draft}-point`, `${SRC.draft}-line`, `${SRC.draft}-fill`, ...[...SHAPE_LAYERS].reverse()]
  for (const layer of layers) if (map.getLayer(layer)) map.removeLayer(layer)
  for (const source of Object.values(SRC)) if (map.getSource(source)) map.removeSource(source)
  map = undefined
})

const corner = computed(() => (props.control === true ? 'top-right' : props.control || 'top-right'))
const ICONS: Record<MapDrawMode, string> = { point: 'location_on', line: 'polyline', polygon: 'pentagon' }
const titles = computed<Record<MapDrawMode, string>>(() => ({ point: t.mapDrawPoint, line: t.mapDrawLine, polygon: t.mapDrawPolygon }))

defineExpose({
  /** Starts drawing a shape (again: finishes) */
  start,
  /** Ends drawing, keeping the shape when it has enough points */
  finish,
  /** Selects a shape by id (null: none) */
  select,
  /** Deletes a shape (the selected one by default) */
  remove,
  /** Deletes every shape */
  clear,
})
</script>

<template>
  <div class="hidden">
    <MMapControl v-if="control" :position="corner">
      <button
        v-for="m in modes"
        :key="m"
        type="button"
        class="grid place-items-center"
        :title="titles[m]"
        :aria-label="titles[m]"
        :aria-pressed="mode === m"
        @click="start(m)"
      >
        <MIcon :name="ICONS[m]" :size="20" />
      </button>
      <button
        v-if="editable"
        type="button"
        class="grid place-items-center"
        :title="t.mapDeleteFeature"
        :aria-label="t.mapDeleteFeature"
        :disabled="selected === null"
        @click="remove()"
      >
        <MIcon name="delete" :size="20" />
      </button>
    </MMapControl>
  </div>
</template>
