import { computed, getCurrentInstance, inject, onBeforeUnmount, onMounted, provide, toValue, watch, type ComputedRef, type InjectionKey, type MaybeRefOrGetter, type Ref, type ShallowRef } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import type { MapLayerModel } from './mapAdapters'
import type { MapLayerState } from './useMapLayers'

/** The `maplibre-gl` module (its classes: `Map`, `Marker`, `Popup`…) */
export type MaplibreModule = typeof import('maplibre-gl')

/** What `MMap` provides to everything inside it. */
export interface MapContext {
  /** The MapLibre map, once created (never on the server) */
  map: ShallowRef<Maplibre.Map | undefined>
  /** The `maplibre-gl` module, loaded with the map (so nothing imports it on the server) */
  maplibre: ShallowRef<MaplibreModule | undefined>
  /** Bumped on every `style.load`: sources and layers added by components are re-added after a style change */
  styleVersion: Ref<number>
  /** The style as `MMap`'s `adapter` reads it (undefined without one) */
  model: ShallowRef<MapLayerModel | undefined>
  /** Visibility and opacity of the model's layers */
  layerState: MapLayerState
  /**
   * The tool that owns the map's clicks right now (`'measure'` while measuring), or null: `MMapIdentify` stays quiet
   * meanwhile. Set it from tools of your own the same way
   */
  activeTool: Ref<string | null>
}

// Internal: provided by MMap
export const MAP_KEY: InjectionKey<MapContext> = Symbol('m3-map')

/**
 * A map to use from outside `<MMap>`: the `MMap` itself (a template ref: `<MMap ref="map">` → `:map="map"`) or its
 * `context`. Null or undefined until it mounts.
 */
export type MapSource = { context: MapContext } | MapContext | null | undefined

/**
 * Internal: the enclosing MMap's context or, outside one, a context that follows `source` (empty until it's
 * there), provided to the caller's children too. Null when there's neither.
 */
export function resolveMapContext(source?: MaybeRefOrGetter<MapSource>): MapContext | null {
  const injected = inject(MAP_KEY, null)
  if (injected || source === undefined) return injected
  const ctx = computed(() => {
    const s = toValue(source)
    return !s ? undefined : 'context' in s ? s.context : s
  })
  const empty = { visible: {} as Record<string, boolean>, opacity: {} as Record<string, number> }
  const forwarded = {
    map: computed(() => ctx.value?.map.value),
    maplibre: computed(() => ctx.value?.maplibre.value),
    styleVersion: computed(() => ctx.value?.styleVersion.value ?? 0),
    model: computed(() => ctx.value?.model.value),
    // Reads and writes reach the map's own state once it's there
    layerState: new Proxy(empty, { get: (target, key) => Reflect.get(ctx.value?.layerState ?? target, key) }),
    activeTool: computed({
      get: () => ctx.value?.activeTool.value ?? null,
      set: (v) => { if (ctx.value) ctx.value.activeTool.value = v },
    }),
  } as unknown as MapContext
  provide(MAP_KEY, forwarded)
  return forwarded
}

type MapEventType = keyof Maplibre.MapEventType
type LayerEventType = keyof Maplibre.MapLayerEventType

/**
 * The map of the enclosing `MMap`, for your own controls, layers and handlers (call it in a component inside
 * `MMap`). Listeners added through it are removed when the component unmounts. Outside an `MMap` (a side panel),
 * pass it one: the `MMap`'s template ref, or a getter for it; until it mounts, `map` is undefined and `onReady` waits.
 *
 * ```ts
 * const { map, onLayer } = useMap()
 * onLayer('click', 'parcels-fill', (e) => console.log(e.features?.[0]?.properties))
 *
 * // In a panel next to the map: <MMap ref="mapRef"> … <MyPanel :map="mapRef" />
 * const { map } = useMap(() => props.map)
 * ```
 */
export function useMap(source?: MaybeRefOrGetter<MapSource>) {
  const ctx = resolveMapContext(source)
  if (!ctx) throw new Error('useMap() must be called in a component inside <MMap>, or be given one')
  const cleanups: (() => void)[] = []
  if (getCurrentInstance()) onBeforeUnmount(() => cleanups.splice(0).forEach((fn) => fn()))

  /**
   * Runs `fn` with the map as soon as it exists (right away if it already does), and in a component not before it's
   * mounted, so its template refs are there.
   */
  function onReady(fn: (map: Maplibre.Map, maplibre: MaplibreModule) => void) {
    const run = () => {
      if (ctx!.map.value && ctx!.maplibre.value) return fn(ctx!.map.value, ctx!.maplibre.value)
      const stop = watch(ctx!.map, (map) => {
        if (!map || !ctx!.maplibre.value) return
        stop()
        fn(map, ctx!.maplibre.value)
      })
      cleanups.push(stop)
    }
    const instance = getCurrentInstance()
    if (instance && !instance.isMounted) onMounted(run)
    else run()
  }

  /** A map event listener (`click`, `moveend`, `style.load`…), removed on unmount. */
  function on<T extends MapEventType>(type: T, listener: (e: Maplibre.MapEventType[T] & object) => void) {
    onReady((map) => {
      map.on(type, listener)
      cleanups.push(() => map.off(type, listener))
    })
  }

  /**
   * A listener for one layer's features (`click`, `mouseenter`, `mousemove`…: `e.features` holds the features under
   * the pointer), removed on unmount. It survives style changes, being keyed by the layer id.
   */
  function onLayer<T extends LayerEventType>(type: T, layerId: string, listener: (e: Maplibre.MapLayerEventType[T] & object) => void) {
    onReady((map) => {
      map.on(type, layerId, listener)
      cleanups.push(() => map.off(type, layerId, listener))
    })
  }

  // computed, not readonly(): readonly() is deep, and a proxied maplibre Map breaks
  return {
    map: computed(() => ctx.map.value) as ComputedRef<Maplibre.Map | undefined>,
    maplibre: computed(() => ctx.maplibre.value) as ComputedRef<MaplibreModule | undefined>,
    styleVersion: computed(() => ctx.styleVersion.value),
    /** The tool that owns the map's clicks (null: none): set it while yours does, and leave it alone otherwise */
    activeTool: ctx.activeTool,
    onReady,
    on,
    onLayer,
  }
}
