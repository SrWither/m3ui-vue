import { inject } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { MAP_KEY } from './useMap'

// The style's own filter of each layer we filter (undefined: none), per map
const originals = new WeakMap<Maplibre.Map, Map<string, Maplibre.FilterSpecification | undefined>>()

/**
 * Filters for the layers of the enclosing `MMap`, on top of the filters their style already has (a layer that only
 * draws parks keeps doing so): `setFilter(layer, expression)` combines both, `setFilter(layer, null)` brings the
 * style's back. `MMapFilter` is built on it; use it for filters of your own (a range slider, a date, a search…).
 */
export function useMapFilter() {
  const ctx = inject(MAP_KEY, null)
  if (!ctx) throw new Error('useMapFilter() must be called in a component inside <MMap>')

  function setFilter(layerId: string, filter: Maplibre.FilterSpecification | null) {
    const map = ctx!.map.value
    if (!map?.getLayer(layerId)) return
    let saved = originals.get(map)
    if (!saved) originals.set(map, (saved = new Map()))
    if (!saved.has(layerId)) saved.set(layerId, map.getFilter(layerId) ?? undefined)
    const original = saved.get(layerId)
    map.setFilter(layerId, filter ? (original ? ['all', original, filter] : filter) as Maplibre.FilterSpecification : original ?? null)
  }

  /**
   * The distinct values of a property among a layer's features loaded in the map (for vector tiles, the tiles in
   * view), sorted.
   */
  function valuesOf(layerId: string, property: string): (string | number)[] {
    const map = ctx!.map.value
    const layer = map?.getLayer(layerId) as (Maplibre.StyleLayer & { source?: string; sourceLayer?: string }) | undefined
    if (!map || !layer?.source) return []
    const features = map.querySourceFeatures(layer.source, layer.sourceLayer ? { sourceLayer: layer.sourceLayer } : undefined)
    const values = new Set<string | number>()
    for (const f of features) {
      const v = f.properties?.[property]
      if (typeof v === 'string' || typeof v === 'number') values.add(v)
    }
    return [...values].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))))
  }

  return { setFilter, valuesOf }
}
