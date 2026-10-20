import { computed, getCurrentInstance, inject, onBeforeUnmount, onMounted, watch, type ComputedRef, type InjectionKey, type Ref, type ShallowRef } from 'vue'
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
}

// Internal: provided by MMap
export const MAP_KEY: InjectionKey<MapContext> = Symbol('m3-map')

type MapEventType = keyof Maplibre.MapEventType
type LayerEventType = keyof Maplibre.MapLayerEventType

/**
 * The map of the enclosing `MMap`, for your own controls, layers and handlers (call it in a component inside
 * `MMap`). Listeners added through it are removed when the component unmounts.
 *
 * ```ts
 * const { map, onLayer } = useMap()
 * onLayer('click', 'parcels-fill', (e) => console.log(e.features?.[0]?.properties))
 * ```
 */
export function useMap() {
  const ctx = inject(MAP_KEY, null)
  if (!ctx) throw new Error('useMap() must be called in a component inside <MMap>')
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
    onReady,
    on,
    onLayer,
  }
}
