<script lang="ts">
import type { LngLat } from '../composables/_mapGeometry'

/** A stop on an `MMapRoute`: a pickup, a drop-off, a waypoint. */
export interface MapRouteStop {
  /** Where it is, `[lng, lat]` */
  lngLat: LngLat
  /** Its name (the marker's accessible name and tooltip) */
  label?: string
  /** A Material Symbol inside its marker. Defaults to a number for the stops in between, a flag for the last one */
  icon?: string
  /** Mark it reached (or not) yourself, instead of by where the vehicle is along the route */
  done?: boolean
}
</script>

<script setup lang="ts">
/**
 * A route on an `MMap`, for deliveries and trips: the path (from your routing service, or straight lines between the
 * stops), the part already travelled solid and the rest dotted, a marker per stop, reached ones filled, and a vehicle
 * that moves along the road, not across it, when its position changes. Drive it with `progress` (0–1 of the way) or
 * `vehicle` (a live GPS position, which lands on the nearest point of the route). Theme colors, following palette and
 * dark mode. Available from the `/map` entry point.
 *
 * @slot stop A stop's marker, instead of the round one. Scope: `{ stop, index, done }`
 * @slot stop-popup Content of a popup that opens when a stop is clicked. Scope: `{ stop, index, done }`
 * @slot vehicle The vehicle, instead of the round one (an image, a top-down car, a pin). Scope: `{ bearing, west }`:
 *   the heading in degrees, and whether it's heading west (to mirror something drawn facing right). With
 *   `rotateVehicle` the marker turns it with the road itself
 * @event stop-click A stop was clicked: the stop and its index
 * @event arrive The vehicle reached the end of the route
 * @event route `provider` returned a road (`{ path, distance, duration }`)
 * @event error `provider` failed
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, useSlots, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MIcon from './MIcon.vue'
import MMapMarker from './MMapMarker.vue'
import { useMap } from '../composables/useMap'
import { useThemeTokens } from '../composables/useThemeTokens'
import { useLocale } from '../composables/useLocale'
import { prefersReducedMotion } from '../composables/_springAnimation'
import { bearing, bounds, cumulative, pointAlong, project, projectForward, slicePath } from '../composables/_routeGeometry'
import type { MapRouteProvider, MapRouteResult } from '../composables/mapRouting'

// Its markers and vehicle are moved into the map: no element of its own for attributes
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The stops, in order: the start, any in between, the destination */
    stops: MapRouteStop[]
    /**
     * The road to follow, `[lng, lat][]`: a routing service's geometry (OSRM, GraphHopper, Mapbox…), with the streets'
     * real shape. Without it, `provider` fetches one, or the stops are joined by straight lines
     */
    path?: LngLat[]
    /** How far the vehicle is, 0–1 of the route's length. Ignored when `vehicle` is set */
    progress?: number
    /** The vehicle's live position, `[lng, lat]`: it's placed on the nearest point of the route */
    vehicle?: LngLat | null
    /** A Material Symbol for the vehicle. The default arrow turns with the road; other icons (`two_wheeler`, `local_shipping`) face the way it goes */
    vehicleIcon?: string
    /**
     * Turn the vehicle with the road (following the map's own rotation too): on for the default arrow, off for other
     * icons (they're mirrored when heading west instead). Set it for `#vehicle` content drawn pointing up (north)
     */
    rotateVehicle?: boolean
    /** Show the vehicle (when there's a `progress` or `vehicle`) */
    showVehicle?: boolean
    /**
     * How long the vehicle takes to move to a new position, in ms (0 jumps). `auto` (default) takes as long as the
     * time between the last two positions, so a vehicle fed every few seconds keeps moving at an even pace instead of
     * stopping between fixes (or slowing down when one arrives early). Reduced motion jumps
     */
    duration?: number | 'auto'
    /** Fit the map to the whole route when it's shown and when the route changes */
    fit?: boolean
    /** Keep the vehicle in the middle of the map as it moves */
    follow?: boolean
    /** Room around the route when fitting it, in px */
    padding?: number
    /** The route's color: one MapLibre reads (hex, rgb()…), not `var()`. Defaults to the theme's primary, following palette and dark mode */
    color?: string
    /** The dots of the route ahead flow toward the destination (off with reduced motion) */
    flow?: boolean
    /** Line width in px */
    width?: number
    /** Insert the route's lines below this layer id (e.g. under the style's labels) */
    before?: string
    /** The source's id (and the prefix of its layers' ids). Generated when left out */
    id?: string
    /**
     * Fetches the road between the stops when there's no `path` (again when they change): `osrmRouteProvider()`, or
     * your own function. Straight lines meanwhile, and if it fails (`error` event)
     */
    provider?: MapRouteProvider
    /**
     * How a `vehicle` position lands on the route: `forward` (default) only moves ahead from where it was, so a route
     * that passes the same place twice (out and back, a loop, close parallel streets) doesn't jump to the other pass;
     * `nearest` takes the closest point of the whole route every time
     */
    snap?: 'forward' | 'nearest'
  }>(),
  { rotateVehicle: undefined, flow: true, vehicleIcon: 'navigation', showVehicle: true, duration: 'auto', fit: true, follow: false, padding: 64, width: 5, snap: 'forward' },
)

const emit = defineEmits<{
  'stop-click': [stop: MapRouteStop, index: number]
  arrive: []
  /** `provider` returned a road: its path, distance (m) and duration (s) */
  route: [route: MapRouteResult]
  /** `provider` failed (the stops stay joined by straight lines) */
  error: [error: unknown]
}>()

const slots = useSlots()
const locale = useLocale()
const sourceId = props.id ?? `m3-route-${useId()}`
const { onReady, styleVersion } = useMap()
const theme = useThemeTokens(['primary', 'outline', 'surface'] as const)

/** The road `provider` returned */
const routed = shallowRef<LngLat[] | null>(null)
const path = computed<LngLat[]>(() =>
  props.path && props.path.length > 1 ? props.path
  : routed.value && routed.value.length > 1 ? routed.value
  : props.stops.map((s) => s.lngLat),
)
const pathKey = computed(() => JSON.stringify(path.value))
const cum = computed(() => cumulative(path.value))
const total = computed(() => cum.value[cum.value.length - 1] ?? 0)
/**
 * Where each stop falls along the route, in meters: in order, each from the one before, so on a round trip the last
 * stop (where the first one is) lands at the end, not the start
 */
const stopAt = computed(() => {
  let from = 0
  return props.stops.map((s) => (from = projectForward(path.value, cum.value, s.lngLat, from, 0)))
})

// The last place a `vehicle` landed on the route (forward snapping goes on from there)
let snapped: number | null = null
function computeTarget(): number | null {
  if (props.vehicle) {
    const d = props.snap === 'nearest' || snapped == null
      ? project(path.value, cum.value, props.vehicle)
      : projectForward(path.value, cum.value, props.vehicle, snapped)
    snapped = d
    return d
  }
  snapped = null
  if (props.progress != null && Number.isFinite(props.progress)) return Math.min(Math.max(props.progress, 0), 1) * total.value
  return null
}
/** Where the vehicle should be, in meters along the route (null: no vehicle) */
const target = ref<number | null>(computeTarget())
// The position by value: an inline `:vehicle="[lng, lat]"` is a new array on every parent render
watch([() => props.vehicle?.join(','), () => props.progress, () => props.snap], () => (target.value = computeTarget()))

// ── provider ──
let controller: AbortController | undefined
async function requestRoute() {
  controller?.abort()
  if (!props.provider || (props.path && props.path.length > 1) || props.stops.length < 2) {
    routed.value = null
    return
  }
  const c = (controller = new AbortController())
  try {
    const result = await props.provider(props.stops.map((s) => s.lngLat), { signal: c.signal })
    if (c.signal.aborted) return
    routed.value = result.path
    emit('route', result)
  } catch (e) {
    if (!c.signal.aborted) {
      routed.value = null
      emit('error', e)
    }
  }
}
// Client only (no fetch while rendering on the server); stops compared by value
onMounted(requestRoute)
watch([() => JSON.stringify(props.stops.map((s) => s.lngLat)), () => props.provider, () => !!(props.path && props.path.length > 1)], () => requestRoute())

// The animated position lives outside Vue's reactivity (one rAF loop); only what the template needs is reactive
let at = 0
const travelled = ref(0)
const bearingNow = ref(0)
let headingNow = 0
let frame = 0

const stopDone = (i: number) => props.stops[i]?.done ?? (target.value != null && travelled.value >= stopAt.value[i]! - 1)

const lineColor = computed(() => props.color ?? theme.value.primary)

let map: Maplibre.Map | undefined
let vehicleMarker: Maplibre.Marker | undefined
const vehicleEl = ref<HTMLElement>()
const layerIds = [`${sourceId}-rest`, `${sourceId}-casing`, `${sourceId}-done`]

type LineFeature = { type: 'Feature'; properties: { part: string }; geometry: { type: 'LineString'; coordinates: LngLat[] } }
function data(d: number): { type: 'FeatureCollection'; features: LineFeature[] } {
  const line = (coordinates: LngLat[], part: string): LineFeature => ({ type: 'Feature', properties: { part }, geometry: { type: 'LineString', coordinates } })
  return {
    type: 'FeatureCollection',
    // Ahead: the whole route, the same every frame, so the dots don't depend on where the vehicle is (a dash pattern
    // is measured from the line's start). The part done is drawn over it, its casing hiding the dots
    features: [line(path.value, 'rest'), line(slicePath(path.value, cum.value, 0, d), 'done')],
  }
}

function layers(): Maplibre.LayerSpecification[] {
  const w = props.width
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  return [
    // Ahead: dotted, in the outline color
    { id: layerIds[0]!, type: 'line', source: sourceId, filter: ['==', ['get', 'part'], 'rest'], layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': theme.value.outline, 'line-width': w * 0.8, 'line-dasharray': dashAt(Math.max(flowStepNow, 0)) } },
    // Done: solid, over a surface-colored casing so it reads on any base map
    { id: layerIds[1]!, type: 'line', source: sourceId, filter: ['==', ['get', 'part'], 'done'], layout: round, paint: { 'line-color': theme.value.surface, 'line-width': w + 4 } },
    { id: layerIds[2]!, type: 'line', source: sourceId, filter: ['==', ['get', 'part'], 'done'], layout: round, paint: { 'line-color': lineColor.value, 'line-width': w } },
  ]
}

function add() {
  if (!map) return
  // tolerance 0: MapLibre simplifies GeoJSON lines per zoom by default, which cut across a roundabout's curve (and
  // changed as the part done grew); a route has to keep the road's exact shape
  if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: data(at), tolerance: 0 })
  for (const layer of layers()) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id)
    map.addLayer(layer, props.before && map.getLayer(props.before) ? props.before : undefined)
  }
}

/** Puts the vehicle and the split of the line at `d` meters (one frame) */
function place(d: number) {
  at = d
  const { lngLat } = pointAlong(path.value, cum.value, d)
  const heading = headingAt(d)
  ;(map?.getSource(sourceId) as Maplibre.GeoJSONSource | undefined)?.setData(data(d))
  vehicleMarker?.setLngLat(lngLat)
  if (rotates.value) vehicleMarker?.setRotation(heading)
  headingNow = heading
  // Only `#vehicle` reads it: updating it for the default icon would re-render the component every frame
  if (slots.vehicle) bearingNow.value = heading
  // Turn the icon around only when clearly heading west or east: going north or south it keeps the way it faced,
  // instead of flipping back and forth as the heading wobbles around 180° on a real road's short segments
  if (heading > 200 && heading < 340) facingWest.value = true
  else if (heading > 20 && heading < 160) facingWest.value = false
  if (props.follow) map?.jumpTo({ center: lngLat })
  // Stops light up as the vehicle passes them; `travelled` only changes when one is crossed, not every frame
  if (reached(d) !== reached(travelled.value)) travelled.value = d
}

const reached = (d: number) => stopAt.value.filter((s) => d >= s - 1).length

const facingWest = ref(false)

// ── flow: the dots ahead streaming toward the destination ──
// The geometry never changes (re-sending it to MapLibre's worker 30 times a second cost a third of the frame rate
// with a few maps, and the dots only moved in the line's first tile: MapLibre lays dash patterns out tile by tile).
// The dash pattern itself is shifted instead, through 16 offsets MapLibre caches, the same in every tile. A pattern
// can't be shifted with round caps (a zero-length dash draws a dot of its own), so the dots are small squares (butt)
const DOT = 1 // dash length, in line widths
const GAP = 1.6
const FLOW_STEPS = 16
const FLOW_PX_PER_S = 16
/** The dash pattern shifted by `step` sixteenths of a period: [dash, gap, dash, gap] covering exactly one period */
function dashAt(step: number): number[] {
  const period = DOT + GAP
  const s = (step / FLOW_STEPS) * period
  // The dot starts `s` into the period; past the gap it wraps around to the period's start
  return s <= GAP ? [0, s, DOT, GAP - s] : [s - GAP, GAP, period - s, 0]
}
let flowFrame = 0
let flowStart = 0
let flowStepNow = -1
function flowStep(now: number) {
  const periodPx = (DOT + GAP) * props.width * 0.8
  const step = Math.floor((((now - flowStart) / 1000) * FLOW_PX_PER_S / periodPx) * FLOW_STEPS) % FLOW_STEPS
  // A growing offset moves the dots toward the destination
  if (step !== flowStepNow && map?.getLayer(layerIds[0]!)) {
    flowStepNow = step
    map.setPaintProperty(layerIds[0]!, 'line-dasharray', dashAt(step))
  }
  flowFrame = requestAnimationFrame(flowStep)
}
// Each new pattern makes MapLibre redraw the map: only while the map is on screen
let onScreen = true
let visibility: IntersectionObserver | undefined
function watchVisibility() {
  if (visibility || !map || typeof IntersectionObserver === 'undefined') return
  visibility = new IntersectionObserver(([entry]) => {
    const now = !!entry?.isIntersecting
    if (now === onScreen) return
    onScreen = now
    startFlow()
  })
  visibility.observe(map.getContainer())
}
function startFlow() {
  cancelAnimationFrame(flowFrame)
  flowStepNow = -1
  watchVisibility()
  if (!onScreen && props.flow) return
  if (props.flow && map && !prefersReducedMotion()) {
    flowStart = performance.now()
    flowFrame = requestAnimationFrame(flowStep)
  } else if (map?.getLayer(layerIds[0]!)) map.setPaintProperty(layerIds[0]!, 'line-dasharray', dashAt(0))
}

/**
 * The heading over a stretch around `d` (10 m behind to 25 m ahead), not the current segment's: a routing service's
 * road is many short segments, and their bearings jitter, which would shake a rotated arrow at every vertex
 */
function headingAt(d: number): number {
  const behind = pointAlong(path.value, cum.value, Math.max(d - 10, 0)).lngLat
  const ahead = pointAlong(path.value, cum.value, Math.min(d + 25, total.value)).lngLat
  return behind[0] === ahead[0] && behind[1] === ahead[1] ? pointAlong(path.value, cum.value, d).bearing : bearing(behind, ahead)
}

/** An icon that turns with the road (the arrow) vs one drawn facing right, flipped when heading west */
const rotates = computed(() => props.rotateVehicle ?? (props.vehicleIcon === 'navigation' && !slots.vehicle))

// For `duration: 'auto'`: when the last position came, and the time between positions (smoothed)
let lastTargetAt = 0
let interval = 0
function moveDuration(): number {
  if (prefersReducedMotion()) return 0
  if (props.duration !== 'auto') return props.duration
  const now = performance.now()
  const gap = now - lastTargetAt
  // A gap over 5 s is a pause (the vehicle waiting, the tab hidden), not how often positions come
  if (lastTargetAt && gap <= 5000) interval = interval ? (interval + Math.max(gap, 100)) / 2 : Math.max(gap, 100)
  lastTargetAt = now
  // Until two positions have come, a second
  return interval || 1000
}

function moveTo(d: number) {
  cancelAnimationFrame(frame)
  const from = at
  const ms = moveDuration()
  if (ms <= 0 || from === d) {
    place(d)
    travelled.value = d
    arrived()
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    // Constant speed, as a vehicle between two GPS fixes
    place(from + (d - from) * t)
    if (t < 1) frame = requestAnimationFrame(step)
    else {
      travelled.value = d
      arrived()
    }
  }
  frame = requestAnimationFrame(step)
}

let wasArrived = false
function arrived() {
  const done = total.value > 0 && at >= total.value - 1
  if (done && !wasArrived) emit('arrive')
  wasArrived = done
}

function fitRoute() {
  if (!map || path.value.length < 2) return
  map.fitBounds(bounds(path.value), { padding: props.padding, duration: prefersReducedMotion() ? 0 : 600 })
}

const showVehicle = computed(() => props.showVehicle && target.value != null)

onReady((m, ml) => {
  map = m
  at = target.value ?? 0
  travelled.value = at
  add()
  if (vehicleEl.value) {
    // Subpixel positions: whole pixels make a slow vehicle step a pixel every few frames, which reads as shaking
    vehicleMarker = new ml.Marker({ element: vehicleEl.value, rotationAlignment: rotates.value ? 'map' : 'viewport', subpixelPositioning: true })
    if (showVehicle.value) vehicleMarker.setLngLat(pointAlong(path.value, cum.value, at).lngLat).addTo(m)
  }
  place(at)
  wasArrived = total.value > 0 && at >= total.value - 1
  if (props.fit) fitRoute()
  startFlow()
})
watch(() => props.flow, startFlow)

watch(styleVersion, () => add())
watch(rotates, (on) => {
  vehicleMarker?.setRotationAlignment(on ? 'map' : 'viewport')
  vehicleMarker?.setRotation(on ? headingNow : 0)
})
watch(target, (d) => {
  // No vehicle any more: the next one starts counting its pace afresh
  if (d == null) lastTargetAt = interval = 0
  else if (map) moveTo(d)
})
watch(showVehicle, (show) => {
  if (!map || !vehicleMarker) return
  if (show) vehicleMarker.setLngLat(pointAlong(path.value, cum.value, at).lngLat).addTo(map)
  else vehicleMarker.remove()
})
// A new route (compared by value: an inline array is new on every parent render): redraw, refit
watch(pathKey, () => {
  snapped = null
  target.value = computeTarget()
  if (!map) return
  at = Math.min(target.value ?? 0, total.value)
  travelled.value = at
  place(at)
  if (props.fit) fitRoute()
})
watch(() => [lineColor.value, theme.value.outline, theme.value.surface, props.width, props.before], () => add())

onBeforeUnmount(() => {
  controller?.abort()
  cancelAnimationFrame(flowFrame)
  visibility?.disconnect()
  cancelAnimationFrame(frame)
  vehicleMarker?.remove()
  if (map) {
    for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  }
  map = undefined
})

const stopIcon = (stop: MapRouteStop, i: number) =>
  stop.icon ?? (i === props.stops.length - 1 ? 'flag' : i === 0 ? 'trip_origin' : undefined)
const stopName = (stop: MapRouteStop, i: number) => stop.label ?? `${locale.mapRouteStop} ${i + 1}`

defineExpose({
  /** Fits the map to the whole route */
  fit: fitRoute,
  /** The route's length, in meters */
  length: total,
  /** How far the vehicle is now, in meters */
  travelled,
  /** The source's id */
  sourceId,
})
</script>

<template>
  <div class="hidden">
    <MMapMarker
      v-for="(stop, i) in stops"
      :key="i"
      :lng-lat="stop.lngLat"
      @click="emit('stop-click', stop, i)"
    >
      <slot name="stop" :stop="stop" :index="i" :done="stopDone(i)">
        <span
          role="img"
          :aria-label="stopName(stop, i)"
          :title="stopName(stop, i)"
          class="m3-map-route-stop flex h-7 w-7 items-center justify-center rounded-full border-2 text-label-medium font-medium shadow-elevation-1 transition-colors duration-300"
          :class="stopDone(i) ? 'border-transparent bg-primary text-on-primary' : 'border-primary bg-surface text-primary'"
          :style="color ? (stopDone(i) ? { background: color } : { borderColor: color, color }) : undefined"
        >
          <MIcon v-if="stopIcon(stop, i)" :name="stopIcon(stop, i)!" :size="16" />
          <template v-else>{{ i }}</template>
        </span>
      </slot>
      <template v-if="$slots['stop-popup']" #popup>
        <slot name="stop-popup" :stop="stop" :index="i" :done="stopDone(i)" />
      </template>
    </MMapMarker>

    <!-- Moved into the map by MapLibre -->
    <div ref="vehicleEl" class="m3-map-route-vehicle" :aria-label="locale.mapRouteVehicle" role="img">
      <!-- A hint of rotation: Firefox draws an element moved only by translate() at whole pixels (measured), so a
           slow vehicle stepped a pixel every few frames and shook; a rotated one is drawn where it really is -->
      <div style="transform: rotate(0.01deg)">
      <slot name="vehicle" :bearing="bearingNow" :west="facingWest">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-primary text-on-primary shadow-elevation-2"
          :style="color ? { background: color } : undefined"
        >
          <!-- Icons drawn facing right turn around when heading west; the arrow is rotated by the marker itself -->
          <MIcon
            :name="vehicleIcon"
            :size="22"
            :filled="vehicleIcon === 'navigation'"
            :style="!rotates && facingWest ? { transform: 'scaleX(-1)' } : undefined"
          />
        </span>
      </slot>
      </div>
    </div>
  </div>
</template>
