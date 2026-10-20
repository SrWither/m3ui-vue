<script setup lang="ts">
/**
 * A MapLibre GL map, for any style: a style URL (from an MVT server like mvt-rs, MapTiler, OpenFreeMap…) or a style
 * object. Its controls take the M3 look and the app's locale, the view can be a v-model and remembered between visits,
 * and markers, popups, GeoJSON layers and your own controls go inside it as components. For anything else, the
 * MapLibre map itself is the `ready` event's argument and the `map` of `useMap()` in components placed inside.
 * Available from the `/map` entry point; needs `maplibre-gl` installed and its CSS imported
 * (`maplibre-gl/dist/maplibre-gl.css`). Give it a height. Server-side rendering renders the empty container: MapLibre
 * loads in the browser.
 *
 * @slot default Map components (`MMapMarker`, `MMapPopup`, `MMapGeoJson`, `MMapControl`) and anything to show over
 * the map, rendered once the map exists
 * @event ready The map loaded (with its style), with the MapLibre `Map`
 * @event click A click on the map (MapLibre's `MapMouseEvent`: `lngLat`, `point`)
 * @event update:center The view moved (on `moveend`): `[lng, lat]`
 * @event update:zoom The zoom changed (on `moveend`)
 * @event update:bearing The rotation changed (on `moveend`)
 * @event update:pitch The tilt changed (on `moveend`)
 */
import { markRaw, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useLocale } from '../composables/useLocale'
import { MAP_KEY, type MaplibreModule } from '../composables/useMap'
import { createLayerState, readLayerState } from '../composables/useMapLayers'
import type { MapAdapter, MapLayerModel } from '../composables/mapAdapters'

export type MapControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const props = withDefaults(
  defineProps<{
    /** The map's style: a style JSON URL or a style object (MapLibre's `StyleSpecification`). Changing it reloads the style */
    mapStyle: string | Maplibre.StyleSpecification
    /** `[lng, lat]` (v-model). When left out, the style's (or the remembered view's) */
    center?: [number, number]
    /** Zoom level (v-model) */
    zoom?: number
    /** Rotation in degrees (v-model) */
    bearing?: number
    /** Tilt in degrees (v-model) */
    pitch?: number
    /**
     * Remember the view (center, zoom, bearing, pitch) in localStorage and start from it on the next visit: `true`
     * under `m3-map-view`, or your own key (one per map)
     */
    persist?: boolean | string
    /** Zoom and compass buttons: `false`, or a corner (`true` is top-right) */
    navigation?: boolean | MapControlPosition
    /** A button that centers the map on the user's location and follows it: `false`, or a corner (`true` is top-right) */
    geolocate?: boolean | MapControlPosition
    /** A fullscreen button: `false`, or a corner (`true` is top-right) */
    fullscreen?: boolean | MapControlPosition
    /** A metric scale bar: `false`, or a corner (`true` is bottom-left) */
    scale?: boolean | MapControlPosition
    /** The style's attribution, compact: `false`, or a corner (`true` is bottom-right). Most tile providers require it */
    attribution?: boolean | MapControlPosition
    /** Anything else for MapLibre's `Map` constructor (`maxZoom`, `maxBounds`, `cooperativeGestures`…) */
    options?: Partial<Omit<Maplibre.MapOptions, 'container' | 'style'>>
    /**
     * Reads the style's conventions (layer names, groups, base layers, what to identify or show on hover) for
     * `MMapLayers`, `MMapBaseLayers`, `MMapIdentify` and `MMapHover`: `genericAdapter`, `orvianAdapter()`, or your own
     */
    adapter?: MapAdapter
  }>(),
  {
    persist: false,
    navigation: true,
    geolocate: false,
    fullscreen: false,
    scale: true,
    attribution: true,
  },
)

const emit = defineEmits<{
  ready: [map: Maplibre.Map]
  click: [event: Maplibre.MapMouseEvent]
  'update:center': [center: [number, number]]
  'update:zoom': [zoom: number]
  'update:bearing': [bearing: number]
  'update:pitch': [pitch: number]
}>()

const root = ref<HTMLElement>()
const container = ref<HTMLElement>()
const map = shallowRef<Maplibre.Map>()
const maplibre = shallowRef<MaplibreModule>()
const styleVersion = ref(0)
const model = shallowRef<MapLayerModel>()
const layerState = createLayerState()
provide(MAP_KEY, { map, maplibre, styleVersion, model, layerState })

/** The adapter's model of the current style, and the layers' visibility and opacity in it. */
function readModel(m: Maplibre.Map) {
  model.value = props.adapter
    ? props.adapter(m.getStyle(), { styleUrl: typeof props.mapStyle === 'string' ? props.mapStyle : undefined })
    : undefined
  readLayerState(layerState, m, model.value)
}

const t = useLocale()

// ── Remembered view ────────────────────────────────────────────────────────────────────────────

interface View { center: [number, number]; zoom: number; bearing: number; pitch: number }
const persistKey = () => (typeof props.persist === 'string' ? props.persist : props.persist ? 'm3-map-view' : null)

function readView(): Partial<View> {
  const key = persistKey()
  if (!key) return {}
  try {
    const view = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<View> | null
    return view && typeof view === 'object' ? view : {}
  } catch {
    return {}
  }
}

function currentView(m: Maplibre.Map): View {
  const c = m.getCenter()
  return { center: [c.lng, c.lat], zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() }
}

// ── Controls ───────────────────────────────────────────────────────────────────────────────────

type ControlName = 'navigation' | 'geolocate' | 'fullscreen' | 'scale' | 'attribution'
const CONTROLS: Record<ControlName, { corner: MapControlPosition; create: (ml: MaplibreModule) => Maplibre.IControl }> = {
  navigation: { corner: 'top-right', create: (ml) => new ml.NavigationControl() },
  geolocate: {
    corner: 'top-right',
    create: (ml) => new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
  },
  fullscreen: { corner: 'top-right', create: (ml) => new ml.FullscreenControl({ container: root.value }) },
  scale: { corner: 'bottom-left', create: (ml) => new ml.ScaleControl({ maxWidth: 100, unit: 'metric' }) },
  attribution: { corner: 'bottom-right', create: (ml) => new ml.AttributionControl({ compact: true }) },
}
const added = new Map<ControlName, Maplibre.IControl>()

function syncControl(name: ControlName) {
  const m = map.value
  const ml = maplibre.value
  if (!m || !ml) return
  const old = added.get(name)
  if (old) {
    m.removeControl(old)
    added.delete(name)
  }
  const setting = props[name]
  if (!setting) return
  const control = CONTROLS[name].create(ml)
  m.addControl(control, setting === true ? CONTROLS[name].corner : setting)
  added.set(name, control)
}

for (const name of Object.keys(CONTROLS) as ControlName[]) watch(() => props[name], () => syncControl(name))

// ── Map ────────────────────────────────────────────────────────────────────────────────────────

/** MapLibre's UI strings, from the app's M3 locale. */
function mapLocale() {
  return {
    'AttributionControl.ToggleAttribution': t.mapToggleAttribution,
    'AttributionControl.MapFeedback': t.mapFeedback,
    'FullscreenControl.Enter': t.mapEnterFullscreen,
    'FullscreenControl.Exit': t.mapExitFullscreen,
    'GeolocateControl.FindMyLocation': t.mapFindMyLocation,
    'GeolocateControl.LocationNotAvailable': t.mapLocationNotAvailable,
    'Map.Title': t.mapTitle,
    'Marker.Title': t.mapMarker,
    'NavigationControl.ResetBearing': t.mapResetBearing,
    'NavigationControl.ZoomIn': t.mapZoomIn,
    'NavigationControl.ZoomOut': t.mapZoomOut,
    'Popup.Close': t.close,
    'CooperativeGesturesHandler.WindowsHelpText': t.mapCtrlScroll,
    'CooperativeGesturesHandler.MacHelpText': t.mapCmdScroll,
    'CooperativeGesturesHandler.MobileHelpText': t.mapTwoFingers,
  }
}

// ── Control tooltips ───────────────────────────────────────────────────────────────────────────
// MapLibre's buttons (and yours, in MMapControl) carry a `title`, which the browser shows as its own tooltip: it's
// moved to data-m3-tip (and aria-label when there's none) and shown as an M3 plain tooltip, inside the map so it's
// there in fullscreen too

const TIP_DELAY = 600 // MTooltip's
const tip = ref<{ text: string; x: number; y: number; left: boolean } | null>(null)
let tipTimer: ReturnType<typeof setTimeout> | undefined
let tipObserver: MutationObserver | undefined

function adoptTitle(el: Element) {
  const title = el.getAttribute('title')
  if (!title || !el.closest('.maplibregl-ctrl')) return
  el.setAttribute('data-m3-tip', title)
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', title)
  el.removeAttribute('title')
}

function showTip(el: HTMLElement) {
  const text = el.getAttribute('data-m3-tip')
  const box = root.value?.getBoundingClientRect()
  if (!text || !box) return
  const r = el.getBoundingClientRect()
  // Toward the inside of the map: left of a control on the right half, right of one on the left
  const left = r.left + r.width / 2 > box.left + box.width / 2
  tip.value = { text, left, x: (left ? r.left - 8 : r.right + 8) - box.left, y: r.top + r.height / 2 - box.top }
}

function hideTip() {
  clearTimeout(tipTimer)
  tip.value = null
}

const tipTarget = (e: Event) => (e.target as Element | null)?.closest?.<HTMLElement>('.maplibregl-ctrl [data-m3-tip]') ?? null

function onTipOver(e: PointerEvent) {
  const el = tipTarget(e)
  if (!el || e.pointerType === 'touch') return
  clearTimeout(tipTimer)
  tipTimer = setTimeout(() => showTip(el), TIP_DELAY)
}
function onTipOut(e: PointerEvent) {
  const el = tipTarget(e)
  if (el && !el.contains(e.relatedTarget as Node | null)) hideTip()
}
function onTipFocus(e: FocusEvent) {
  const el = tipTarget(e)
  if (el?.matches(':focus-visible')) showTip(el)
}

onMounted(() => {
  const el = root.value
  if (!el) return
  el.querySelectorAll('[title]').forEach(adoptTitle)
  tipObserver = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') adoptTitle(r.target as Element)
      else r.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return
        adoptTitle(n)
        n.querySelectorAll('[title]').forEach(adoptTitle)
      })
    }
  })
  tipObserver.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })
})

onBeforeUnmount(() => {
  tipObserver?.disconnect()
  clearTimeout(tipTimer)
})

let destroyed = false

onMounted(async () => {
  // maplibre-gl ships a UMD build: depending on the bundler its classes are on the namespace or on `default`
  const mod = await import('maplibre-gl')
  const ml = ('Map' in mod ? mod : (mod as { default: MaplibreModule }).default) as MaplibreModule
  if (destroyed || !container.value) return
  const saved = readView()
  const view = {
    center: saved.center ?? props.center,
    zoom: saved.zoom ?? props.zoom,
    bearing: saved.bearing ?? props.bearing,
    pitch: saved.pitch ?? props.pitch,
  }
  const m = markRaw(new ml.Map({
    container: container.value,
    style: props.mapStyle,
    attributionControl: false,
    locale: mapLocale(),
    // Only what's set, so a style's own center and zoom apply otherwise
    ...Object.fromEntries(Object.entries(view).filter(([, v]) => v !== undefined)),
    ...props.options,
  }))
  maplibre.value = ml

  m.on('style.load', () => {
    readModel(m)
    styleVersion.value++
  })
  m.on('click', (e) => emit('click', e))
  m.on('moveend', () => {
    const v = currentView(m)
    emit('update:center', v.center)
    emit('update:zoom', v.zoom)
    emit('update:bearing', v.bearing)
    emit('update:pitch', v.pitch)
    const key = persistKey()
    if (key) {
      try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage blocked */ }
    }
  })
  m.once('load', () => {
    // The map is shared once its style is loaded: components can add sources and layers right away
    map.value = m
    for (const name of Object.keys(CONTROLS) as ControlName[]) syncControl(name)
    emit('ready', m)
  })
})

onBeforeUnmount(() => {
  destroyed = true
  map.value?.remove()
  map.value = undefined
})

// ── v-model ────────────────────────────────────────────────────────────────────────────────────
// Compared by value: an inline `:center="[lng, lat]"` is a new array on every parent render

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
watch(() => props.center?.join(','), () => {
  const m = map.value
  if (!m || !props.center) return
  const c = m.getCenter()
  if (!near(c.lng, props.center[0]) || !near(c.lat, props.center[1])) m.jumpTo({ center: props.center })
})
watch(() => props.zoom, (zoom) => {
  if (map.value && zoom !== undefined && !near(map.value.getZoom(), zoom)) map.value.jumpTo({ zoom })
})
watch(() => props.bearing, (bearing) => {
  if (map.value && bearing !== undefined && !near(map.value.getBearing(), bearing)) map.value.jumpTo({ bearing })
})
watch(() => props.pitch, (pitch) => {
  if (map.value && pitch !== undefined && !near(map.value.getPitch(), pitch)) map.value.jumpTo({ pitch })
})
watch(() => props.adapter, () => { if (map.value) readModel(map.value) })
// A full reload (no diff): style.load fires, and components re-add their sources and layers
watch(() => props.mapStyle, (style) => map.value?.setStyle(style, { diff: false }))

defineExpose({
  /** The MapLibre map, once loaded */
  map,
})
</script>

<template>
  <div
    ref="root"
    class="m3-map relative overflow-hidden"
    @pointerover="onTipOver"
    @pointerout="onTipOut"
    @pointerdown="hideTip"
    @focusin="onTipFocus"
    @focusout="hideTip"
  >
    <!-- Sized, not positioned: MapLibre's CSS makes it position: relative (.maplibregl-map), which would undo absolute -->
    <div ref="container" class="h-full w-full" />
    <slot v-if="map" />
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tip"
        role="tooltip"
        class="pointer-events-none absolute z-10 min-h-6 max-w-[200px] -translate-y-1/2 rounded bg-inverse-surface px-2 py-1 text-body-small whitespace-nowrap text-inverse-on-surface"
        :class="tip.left ? '-translate-x-full' : ''"
        :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
      >
        {{ tip.text }}
      </div>
    </Transition>
  </div>
</template>

<style>
/* The app's typeface, not MapLibre's Helvetica (attribution, scale, popups) */
.m3-map .maplibregl-map {
  font: inherit;
}

/* MapLibre's controls, popups and markers in M3: the theme's colors (they follow palette and dark mode), Material
   Symbols icons instead of MapLibre's fixed-color SVGs, M3 shapes and elevation. Scoped to .m3-map. */
.m3-map .maplibregl-ctrl-group {
  background: var(--color-surface-container-high);
  border-radius: 12px;
  box-shadow: var(--shadow-elevation-2);
  overflow: hidden;
}
.m3-map .maplibregl-ctrl-group:not(:empty) {
  box-shadow: var(--shadow-elevation-2);
}
.m3-map .maplibregl-ctrl-group button {
  width: 40px;
  height: 40px;
  color: var(--color-on-surface-variant);
}
.m3-map .maplibregl-ctrl-group button + button {
  border-top: 1px solid var(--color-outline-variant);
}
.m3-map .maplibregl-ctrl button:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}
.m3-map .maplibregl-ctrl button:not(:disabled):active {
  background-color: color-mix(in srgb, var(--color-on-surface) 12%, transparent);
}
.m3-map .maplibregl-ctrl-group button[aria-pressed='true'] {
  background-color: var(--color-primary-container);
  color: var(--color-on-primary-container);
}
.m3-map .maplibregl-ctrl button:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-secondary);
}
.m3-map .maplibregl-ctrl button:disabled {
  color: color-mix(in srgb, var(--color-on-surface) 38%, transparent);
}
.m3-map .maplibregl-ctrl button .maplibregl-ctrl-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: none !important;
}
.m3-map .maplibregl-ctrl button .maplibregl-ctrl-icon::before,
.m3-map .maplibregl-ctrl-attrib-button::before {
  font-family: 'Material Symbols Outlined';
  font-size: 20px;
  line-height: 1;
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
.m3-map .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon::before { content: 'add'; }
.m3-map .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon::before { content: 'remove'; }
.m3-map .maplibregl-ctrl-compass .maplibregl-ctrl-icon::before { content: 'navigation'; }
.m3-map .maplibregl-ctrl-geolocate .maplibregl-ctrl-icon::before { content: 'my_location'; }
.m3-map .maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-active,
.m3-map .maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background,
.m3-map .maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-waiting {
  color: var(--color-primary);
}
.m3-map .maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background .maplibregl-ctrl-icon::before { content: 'location_searching'; }
.m3-map .maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-active-error,
.m3-map .maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background-error {
  color: var(--color-error);
}
.m3-map .maplibregl-ctrl-geolocate:disabled .maplibregl-ctrl-icon::before { content: 'location_disabled'; }
.m3-map .maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon::before { content: 'fullscreen'; }
.m3-map .maplibregl-ctrl-shrink .maplibregl-ctrl-icon::before { content: 'fullscreen_exit'; }

/* Compact attribution: a surface pill with an info button */
.m3-map .maplibregl-ctrl-attrib {
  background: color-mix(in srgb, var(--color-surface-container-high) 90%, transparent);
  color: var(--color-on-surface-variant);
}
.m3-map .maplibregl-ctrl-attrib a {
  color: inherit;
}
.m3-map .maplibregl-ctrl-attrib.maplibregl-compact {
  min-height: 28px;
  border-radius: 14px;
}
.m3-map .maplibregl-ctrl-attrib-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  background: none !important;
  color: var(--color-on-surface-variant);
}
.m3-map .maplibregl-ctrl-attrib-button::before {
  content: 'info';
  font-size: 18px;
}
.m3-map .maplibregl-ctrl-scale {
  background: color-mix(in srgb, var(--color-surface-container-high) 85%, transparent);
  border-color: var(--color-outline);
  color: var(--color-on-surface-variant);
  font-size: 11px;
}

/* Popups: an M3 surface (elevation 2, 16px corners) with a matching tip */
.m3-map .maplibregl-popup-content {
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
  box-shadow: var(--shadow-elevation-2);
  overflow: hidden;
  font: inherit;
  font-size: var(--text-body-medium);
  line-height: var(--text-body-medium--line-height);
}
.m3-map .maplibregl-popup-anchor-top .maplibregl-popup-tip,
.m3-map .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
.m3-map .maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
  border-bottom-color: var(--color-surface-container-high);
}
.m3-map .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
.m3-map .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
.m3-map .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
  border-top-color: var(--color-surface-container-high);
}
.m3-map .maplibregl-popup-anchor-left .maplibregl-popup-tip {
  border-right-color: var(--color-surface-container-high);
}
.m3-map .maplibregl-popup-anchor-right .maplibregl-popup-tip {
  border-left-color: var(--color-surface-container-high);
}
.m3-map .maplibregl-popup-close-button {
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  color: var(--color-on-surface-variant);
  font-size: 18px;
  line-height: 1;
}
.m3-map .maplibregl-popup-close-button:hover {
  background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}

/* The default marker takes the theme's primary (its SVG is drawn in currentColor) */
.m3-map .m3-map-marker--default {
  color: var(--color-primary);
}
</style>
