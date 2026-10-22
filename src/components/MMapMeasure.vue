<script setup lang="ts">
/**
 * Distance and area measuring on an `MMap`, with its own control (distance, area, clear). Click to add points (a
 * preview follows the pointer), double-click, Enter or Escape to finish, click the first point to close the shape, or
 * press the active button again (in fullscreen, Escape finishes it too where the browser allows: Chromium). Finished
 * measurements stay editable: drag a vertex, or a midpoint to add one; the ✕ on a total or area deletes that one.
 * Labels show each segment, the total and the area; everything follows the theme. While measuring it owns the map's clicks
 * (`MMapIdentify` waits). Geodesic numbers, the same as turf's. Available from the `/map` entry point.
 *
 * @event update:modelValue The measuring mode changed (`'distance'`, `'area'`, or null when it finished)
 * @event change The measurements changed (added, edited, cleared): each one's points, length in meters and area in m²
 */
import { computed, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MIcon from './MIcon.vue'
import MMapControl from './MMapControl.vue'
import MMapMarker from './MMapMarker.vue'
import { useLocale } from '../composables/useLocale'
import { useMap } from '../composables/useMap'
import { useThemeTokens } from '../composables/useThemeTokens'
import { centroid, closeRing, distance, midpoint, pathLength, ringArea, type LngLat } from '../composables/_mapGeometry'
import type { MapControlPosition } from './MMap.vue'

type Mode = 'distance' | 'area'

const props = withDefaults(
  defineProps<{
    /** The measuring mode (v-model): `'distance'`, `'area'`, or null. Set it to start measuring from outside */
    modelValue?: Mode | null
    /** Its buttons: `false` (drive it with v-model), or a corner (`true` is top-right) */
    control?: boolean | MapControlPosition
  }>(),
  { modelValue: null, control: true },
)

const emit = defineEmits<{
  'update:modelValue': [mode: Mode | null]
  change: [measurements: { mode: Mode; points: LngLat[]; closed: boolean; length: number; area?: number }[]]
}>()

const t = useLocale()
const { onReady, styleVersion, activeTool } = useMap()
const theme = useThemeTokens(['primary', 'surface'] as const)

const id = `m3-measure-${useId()}`
const SRC = { done: `${id}-done`, draft: `${id}-draft`, handles: `${id}-handles` }
const VERTEX = `${SRC.handles}-vertex`
const MIDPOINT = `${SRC.handles}-midpoint`

interface Measurement { mode: Mode; points: LngLat[]; closed: boolean }
// Plain state, stepped on every pointer move: only the labels and the buttons are reactive
const measurements: Measurement[] = []
let draft: LngLat[] = []
let cursor: LngLat | null = null
let closingByFirst = false
let drag: { m: number; v: number } | null = null
let raf = 0
let map: Maplibre.Map | undefined

const mode = ref<Mode | null>(null)
const count = ref(0)
// `m`: the finished measurement a total or area label belongs to (it carries that one's delete button)
const labels = shallowRef<{ key: string; at: LngLat; text: string; kind: 'segment' | 'total' | 'area'; m?: number }[]>([])

// ── Text ───────────────────────────────────────────────────────────────────────────────────────

const lang = () => (typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined)
const num = (n: number, digits: number) => new Intl.NumberFormat(lang(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
const fmtDistance = (m: number) => (m === 0 ? '' : m < 1000 ? `${num(Math.round(m), 0)} m` : `${num(m / 1000, 2)} km`)
const fmtArea = (m2: number) => (m2 >= 1e6 ? `${num(m2 / 1e6, 2)} km²` : m2 >= 1e4 ? `${num(m2 / 1e4, 2)} ha` : `${num(Math.round(m2), 0)} m²`)

// ── GeoJSON ────────────────────────────────────────────────────────────────────────────────────

// Just the GeoJSON this draws (the global GeoJSON namespace isn't always typed)
type Geometry = { type: 'Point'; coordinates: LngLat } | { type: 'LineString'; coordinates: LngLat[] } | { type: 'Polygon'; coordinates: LngLat[][] }
type Feature = { type: 'Feature'; geometry: Geometry; properties: Record<string, unknown> }
type Label = (typeof labels.value)[number]
const point = (p: LngLat, properties: Record<string, unknown> = {}): Feature => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties })

/** A measurement's shapes, and its labels. */
function build(points: LngLat[], m: Mode, key: string, index?: number): { features: Feature[]; labels: Label[] } {
  const features: Feature[] = points.map((p) => point(p))
  const out: Label[] = []
  if (points.length < 2) return { features, labels: out }
  features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} })
  const segments = (path: LngLat[]) => {
    for (let i = 0; i < path.length - 1; i++) {
      const text = fmtDistance(distance(path[i]!, path[i + 1]!))
      if (text) out.push({ key: `${key}-s${i}`, at: midpoint(path[i]!, path[i + 1]!), text, kind: 'segment' })
    }
  }
  if (m === 'distance') {
    segments(points)
    out.push({ key: `${key}-t`, at: points[points.length - 1]!, text: `${t.mapTotal}: ${fmtDistance(pathLength(points))}`, kind: 'total', m: index })
  } else if (points.length >= 3) {
    const ring = closeRing(points)
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} })
    segments(ring)
    out.push({ key: `${key}-a`, at: centroid(ring), text: fmtArea(ringArea(ring)), kind: 'area', m: index })
  } else {
    out.push({ key: `${key}-t`, at: points[points.length - 1]!, text: fmtDistance(pathLength(points)), kind: 'total', m: index })
  }
  return { features, labels: out }
}

const collection = (features: Feature[]) => ({ type: 'FeatureCollection' as const, features })
const setData = (source: string, features: Feature[]) => (map?.getSource(source) as Maplibre.GeoJSONSource | undefined)?.setData(collection(features))

function render() {
  if (!map) return
  const done = measurements.map((m, i) => build(m.points, m.mode, `m${i}`, i))
  const preview = mode.value && draft.length ? build(cursor ? [...draft, cursor] : draft, mode.value, 'draft') : { features: [], labels: [] }
  setData(SRC.done, done.flatMap((d) => d.features))
  setData(SRC.draft, preview.features)
  // Edit handles while not drawing: every vertex, and every segment's midpoint
  const handles: Feature[] = []
  if (!mode.value) {
    measurements.forEach((m, mi) => {
      const vertices = m.closed ? m.points.slice(0, -1) : m.points
      vertices.forEach((p, vi) => handles.push(point(p, { handle: 'vertex', m: mi, v: vi })))
      for (let i = 0; i < m.points.length - 1; i++) handles.push(point(midpoint(m.points[i]!, m.points[i + 1]!), { handle: 'midpoint', m: mi, after: i }))
    })
  }
  setData(SRC.handles, handles)
  labels.value = [...done.flatMap((d) => d.labels), ...preview.labels]
}

function report() {
  count.value = measurements.length
  emit('change', measurements.map((m) => ({
    mode: m.mode,
    points: m.points.map((p) => [...p] as LngLat),
    closed: m.closed,
    length: pathLength(m.points),
    ...(m.mode === 'area' || m.closed ? { area: ringArea(m.points) } : {}),
  })))
}

// ── Layers ─────────────────────────────────────────────────────────────────────────────────────

const is = (type: string): Maplibre.FilterSpecification => ['==', ['geometry-type'], type]

function paints() {
  const { primary, surface } = theme.value
  return {
    fill: { 'fill-color': primary },
    line: { 'line-color': primary },
    vertices: { 'circle-color': surface, 'circle-stroke-color': primary },
  }
}

function ensureLayers() {
  if (!map) return
  for (const source of Object.values(SRC)) {
    if (!map.getSource(source)) map.addSource(source, { type: 'geojson', data: collection([]) })
  }
  const p = paints()
  const add = (layer: Maplibre.LayerSpecification) => { if (!map!.getLayer(layer.id)) map!.addLayer(layer) }
  for (const [source, draftStyle] of [[SRC.done, false], [SRC.draft, true]] as const) {
    add({ id: `${source}-fill`, type: 'fill', source, filter: is('Polygon'), paint: { ...p.fill, 'fill-opacity': draftStyle ? 0.15 : 0.2 } })
    add({ id: `${source}-line`, type: 'line', source, filter: ['!=', ['geometry-type'], 'Point'], paint: { ...p.line, 'line-width': 3, ...(draftStyle ? { 'line-dasharray': [2, 2] } : {}) } })
    add({ id: `${source}-points`, type: 'circle', source, filter: is('Point'), paint: { ...p.vertices, 'circle-radius': 5, 'circle-stroke-width': 2 } })
  }
  add({ id: MIDPOINT, type: 'circle', source: SRC.handles, filter: ['==', ['get', 'handle'], 'midpoint'], paint: { ...p.vertices, 'circle-radius': 4, 'circle-stroke-width': 1.5, 'circle-opacity': 0.7 } })
  add({ id: VERTEX, type: 'circle', source: SRC.handles, filter: ['==', ['get', 'handle'], 'vertex'], paint: { ...p.vertices, 'circle-radius': 7, 'circle-stroke-width': 2.5 } })
}

watch(theme, () => {
  if (!map) return
  const p = paints()
  const set = (layer: string, paint: Record<string, unknown>) => {
    if (map!.getLayer(layer)) for (const [k, v] of Object.entries(paint)) map!.setPaintProperty(layer, k, v)
  }
  for (const source of [SRC.done, SRC.draft]) {
    set(`${source}-fill`, p.fill)
    set(`${source}-line`, p.line)
    set(`${source}-points`, p.vertices)
  }
  set(MIDPOINT, p.vertices)
  set(VERTEX, p.vertices)
})

// ── Measuring ──────────────────────────────────────────────────────────────────────────────────

const lngLatOf = (e: { lngLat: { lng: number; lat: number } }): LngLat => [e.lngLat.lng, e.lngLat.lat]

function onClick(e: Maplibre.MapMouseEvent) {
  if (draft.length >= 2) {
    const first = map!.project(draft[0]!)
    if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 20) {
      closingByFirst = true
      finish()
      return
    }
  }
  draft.push(lngLatOf(e))
  render()
}

function onMove(e: Maplibre.MapMouseEvent) {
  cursor = lngLatOf(e)
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    render()
  })
}

function onDblClick(e: Maplibre.MapMouseEvent) {
  e.preventDefault()
  if (draft.length < 2) return
  // The double click's first click added a point on top of the last one
  const a = map!.project(draft[draft.length - 1]!)
  const b = map!.project(draft[draft.length - 2]!)
  if (Math.hypot(a.x - b.x, a.y - b.y) < 10) draft.pop()
  finish()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === 'Enter') finish(e.key === 'Escape')
}

// In fullscreen the browser keeps Escape to leave it, and the page never sees it. Keyboard Lock (Chromium) lets the
// page have it while measuring, so Escape finishes the measurement (holding Escape still leaves fullscreen)
type KeyboardLock = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void }
const keyboard = () => (typeof navigator !== 'undefined' ? (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard : undefined)
let locked = false
function lockEscape() {
  if (!mode.value || !document.fullscreenElement || !keyboard()?.lock) return
  keyboard()!.lock!(['Escape']).then(() => { locked = true }, () => {})
}
function unlockEscape() {
  // Measuring again by then: that measurement holds the lock now
  if (mode.value) return
  if (locked) keyboard()?.unlock?.()
  locked = false
}
// Released once the Escape that finished the measurement is let go: unlocking during its keydown hands the rest of
// that press back to the browser, which then leaves fullscreen anyway
function unlockAfterEscape() {
  let fallback: ReturnType<typeof setTimeout> | undefined
  const done = () => {
    document.removeEventListener('keyup', onUp, true)
    clearTimeout(fallback)
    setTimeout(unlockEscape)
  }
  const onUp = (e: KeyboardEvent) => { if (e.key === 'Escape') done() }
  document.addEventListener('keyup', onUp, true)
  fallback = setTimeout(done, 1500)
}

function start(next: Mode) {
  if (!map) return
  if (mode.value === next) return finish()
  if (mode.value) finish()
  mode.value = next
  activeTool.value = 'measure'
  draft = []
  cursor = null
  map.getCanvas().style.cursor = 'crosshair'
  map.doubleClickZoom.disable()
  map.on('click', onClick)
  map.on('mousemove', onMove)
  map.on('dblclick', onDblClick)
  document.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', lockEscape)
  lockEscape()
  render()
  if (props.modelValue !== next) emit('update:modelValue', next)
}

function finish(byEscape = false) {
  if (!map || !mode.value) return
  cancelAnimationFrame(raf)
  raf = 0
  const closed = draft.length >= 3 && (closingByFirst || mode.value === 'area')
  if (draft.length >= 2) {
    measurements.push({ mode: mode.value, points: closed ? [...draft, [...draft[0]!] as LngLat] : draft, closed })
  }
  draft = []
  cursor = null
  closingByFirst = false
  mode.value = null
  if (activeTool.value === 'measure') activeTool.value = null
  map.getCanvas().style.cursor = ''
  map.doubleClickZoom.enable()
  map.off('click', onClick)
  map.off('mousemove', onMove)
  map.off('dblclick', onDblClick)
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', lockEscape)
  if (byEscape && locked) unlockAfterEscape()
  else unlockEscape()
  render()
  report()
  if (props.modelValue !== null) emit('update:modelValue', null)
}

/** Deletes one finished measurement. */
function remove(index: number) {
  if (!measurements[index]) return
  measurements.splice(index, 1)
  render()
  report()
}

function clear() {
  if (mode.value) finish()
  measurements.length = 0
  render()
  report()
}

// ── Editing ────────────────────────────────────────────────────────────────────────────────────

type HandleEvent = (Maplibre.MapMouseEvent | Maplibre.MapTouchEvent) & { features?: Maplibre.MapGeoJSONFeature[] }

function onHandleDown(e: HandleEvent) {
  const f = e.features?.[0]
  if (!f || mode.value || !map) return
  e.preventDefault()
  const mi = f.properties.m as number
  const m = measurements[mi]
  if (!m) return
  let vi = f.properties.v as number
  if (f.properties.handle === 'midpoint') {
    vi = (f.properties.after as number) + 1
    m.points.splice(vi, 0, lngLatOf(e))
  }
  drag = { m: mi, v: vi }
  activeTool.value = 'measure'
  map.getCanvas().style.cursor = 'grabbing'
  const touch = e.type === 'touchstart'
  if (touch) map.dragPan.disable()
  map.on(touch ? 'touchmove' : 'mousemove', onDragMove)
  map.once(touch ? 'touchend' : 'mouseup', onDragEnd)
  render()
}

function onDragMove(e: Maplibre.MapMouseEvent | Maplibre.MapTouchEvent) {
  if (!drag) return
  const m = measurements[drag.m]
  if (!m) return
  const p = lngLatOf(e)
  m.points[drag.v] = p
  if (m.closed && drag.v === 0) m.points[m.points.length - 1] = p
  render()
}

function onDragEnd() {
  if (!map) return
  drag = null
  map.off('mousemove', onDragMove)
  map.off('touchmove', onDragMove)
  map.dragPan.enable()
  map.getCanvas().style.cursor = ''
  report()
  // The click that ends a press comes after mouseup: keep it from MMapIdentify
  setTimeout(() => { if (activeTool.value === 'measure' && !mode.value) activeTool.value = null })
}

const onHandleEnter = () => { if (map && !drag && !mode.value) map.getCanvas().style.cursor = 'grab' }
const onHandleLeave = () => { if (map && !drag && !mode.value) map.getCanvas().style.cursor = '' }

onReady((m) => {
  map = m
  ensureLayers()
  for (const layer of [VERTEX, MIDPOINT]) {
    m.on('mousedown', layer, onHandleDown)
    m.on('touchstart', layer, onHandleDown)
    m.on('mouseenter', layer, onHandleEnter)
    m.on('mouseleave', layer, onHandleLeave)
  }
  if (props.modelValue) start(props.modelValue)
})
watch(styleVersion, () => {
  ensureLayers()
  render()
})
watch(() => props.modelValue, (next) => {
  if (next && next !== mode.value) start(next)
  else if (!next && mode.value) finish()
})

onBeforeUnmount(() => {
  if (!map) return
  if (mode.value) finish()
  for (const layer of [VERTEX, MIDPOINT]) {
    map.off('mousedown', layer, onHandleDown)
    map.off('touchstart', layer, onHandleDown)
    map.off('mouseenter', layer, onHandleEnter)
    map.off('mouseleave', layer, onHandleLeave)
  }
  const layers = [VERTEX, MIDPOINT, ...[SRC.done, SRC.draft].flatMap((s) => [`${s}-points`, `${s}-line`, `${s}-fill`])]
  for (const layer of layers) if (map.getLayer(layer)) map.removeLayer(layer)
  for (const source of Object.values(SRC)) if (map.getSource(source)) map.removeSource(source)
})

const corner = computed(() => (props.control === true ? 'top-right' : props.control || 'top-right'))

defineExpose({ start, finish, clear, remove })
</script>

<template>
  <div class="hidden">
    <MMapControl v-if="control" :position="corner">
      <button type="button" class="grid place-items-center" :title="t.mapMeasureDistance" :aria-pressed="mode === 'distance'" @click="start('distance')">
        <MIcon name="straighten" :size="20" />
      </button>
      <button type="button" class="grid place-items-center" :title="t.mapMeasureArea" :aria-pressed="mode === 'area'" @click="start('area')">
        <MIcon name="pentagon" :size="20" />
      </button>
      <button type="button" class="grid place-items-center" :title="t.mapClearMeasurements" :disabled="!count && !mode" @click="clear">
        <MIcon name="delete" :size="20" />
      </button>
    </MMapControl>
    <!-- Labels: M3 chips that let the pointer through to the map -->
    <MMapMarker
      v-for="label in labels"
      :key="label.key"
      :lng-lat="label.at"
      :anchor="label.kind === 'area' ? 'center' : 'top'"
      :offset="label.kind === 'area' ? [0, 0] : [0, 8]"
      class="pointer-events-none"
    >
      <span
        class="flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 shadow-elevation-1"
        :class="[
          label.kind === 'segment' ? 'bg-surface-container-highest text-label-small text-on-surface' : 'bg-primary text-label-medium text-on-primary',
          label.m !== undefined ? 'pr-0.5 pl-2' : 'px-2',
        ]"
      >
        {{ label.text }}
        <!-- Deletes this measurement; it catches its own pointer, so the map neither pans nor gets a click -->
        <button
          v-if="label.m !== undefined"
          type="button"
          class="pointer-events-auto grid size-5 cursor-pointer place-items-center rounded-full hover:bg-on-primary/12 focus-visible:outline-2 focus-visible:outline-on-primary"
          :aria-label="t.mapDeleteMeasurement"
          :title="t.mapDeleteMeasurement"
          @click.stop="remove(label.m)"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @dblclick.stop
        >
          <MIcon name="close" :size="14" />
        </button>
      </span>
    </MMapMarker>
  </div>
</template>
