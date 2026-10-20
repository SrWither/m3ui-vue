import { computed, inject, reactive } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { MAP_KEY } from './useMap'
import type { MapLayerInfo, MapLayerModel } from './mapAdapters'

/** The paint properties that make each layer type transparent. */
const OPACITY: Record<string, string[]> = {
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  raster: ['raster-opacity'],
  heatmap: ['heatmap-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
}

/** Visibility and opacity of the model's layers, shared by everything inside one `MMap`. */
export interface MapLayerState {
  visible: Record<string, boolean>
  opacity: Record<string, number>
}

// Internal: MMap's shared state, filled from the map on every style load
export function createLayerState(): MapLayerState {
  return reactive({ visible: {}, opacity: {} })
}

export function readLayerState(state: MapLayerState, map: Maplibre.Map, model: MapLayerModel | undefined) {
  const visible: Record<string, boolean> = {}
  const opacity: Record<string, number> = {}
  for (const layer of model?.layers ?? []) {
    const style = map.getLayer(layer.id)
    if (!style) continue
    visible[layer.id] = map.getLayoutProperty(layer.id, 'visibility') !== 'none'
    const prop = OPACITY[style.type]?.[0]
    const value = prop ? map.getPaintProperty(layer.id, prop) : undefined
    opacity[layer.id] = typeof value === 'number' ? value : 1
  }
  state.visible = visible
  state.opacity = opacity
}

/**
 * The layers of the enclosing `MMap`'s style as its `adapter` describes them, with their visibility and opacity, for a
 * layer panel or a base layer switcher of your own (`MMapLayers` and `MMapBaseLayers` are built on it). Changes go to
 * the map and to every component using it; a layer's `children` follow it.
 */
export function useMapLayers() {
  const ctx = inject(MAP_KEY, null)
  if (!ctx) throw new Error('useMapLayers() must be called in a component inside <MMap>')
  const { map, model, layerState: state } = ctx

  const layers = computed(() => model.value?.layers ?? [])
  const byId = computed(() => new Map(layers.value.map((l) => [l.id, l])))

  function isVisible(id: string) {
    return state.visible[id] ?? true
  }

  function setVisible(id: string, visible: boolean) {
    const m = map.value
    if (m?.getLayer(id)) m.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    state.visible[id] = visible
    for (const child of byId.value.get(id)?.children ?? []) setVisible(child, visible)
  }

  function toggle(id: string) {
    setVisible(id, !isVisible(id))
  }

  function opacityOf(id: string) {
    return state.opacity[id] ?? 1
  }

  function setOpacity(id: string, opacity: number) {
    const m = map.value
    const layer = m?.getLayer(id)
    if (layer) for (const prop of OPACITY[layer.type] ?? []) m!.setPaintProperty(id, prop, opacity)
    state.opacity[id] = opacity
    for (const child of byId.value.get(id)?.children ?? []) setOpacity(child, opacity)
  }

  /** The layers of a group (listed ones), or the ungrouped ones with `null`. */
  function layersOf(group: string | null): MapLayerInfo[] {
    return layers.value.filter((l) => l.listed && (group === null ? !l.group || !model.value?.groups.some((g) => g.name === l.group) : l.group === group))
  }

  function groupState(group: string): 'visible' | 'hidden' | 'partial' {
    const visible = layersOf(group).map((l) => isVisible(l.id))
    if (visible.length && visible.every(Boolean)) return 'visible'
    if (visible.some(Boolean)) return 'partial'
    return 'hidden'
  }

  function setGroupVisible(group: string, visible: boolean) {
    for (const layer of layersOf(group)) setVisible(layer.id, visible)
  }

  const baseLayers = computed(() => layers.value.filter((l) => l.base))
  /** The visible base layer's id, or null */
  const baseLayer = computed(() => baseLayers.value.find((l) => isVisible(l.id))?.id ?? null)

  /** Shows this base layer only (null: none). */
  function setBaseLayer(id: string | null) {
    for (const layer of baseLayers.value) setVisible(layer.id, layer.id === id)
  }

  return {
    /** The adapter's model (undefined without an `adapter`) */
    model: computed(() => model.value),
    layers,
    isVisible,
    setVisible,
    toggle,
    opacityOf,
    setOpacity,
    layersOf,
    groupState,
    setGroupVisible,
    baseLayers,
    baseLayer,
    setBaseLayer,
  }
}
