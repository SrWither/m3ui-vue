import type * as Maplibre from 'maplibre-gl'

/*
 * Internal (not exported from index.ts): what MMap carries over when `mapStyle` changes.
 *
 * MapLibre's setStyle() replaces everything, so sources and layers added at runtime (with useMap(), or the
 * library's own MMapGeoJson / MMapMeasure) were gone after a switch, until whoever added them noticed. A
 * `transformStyle` hook moves them into the next style instead: whatever wasn't part of the previous style as
 * loaded (`own`) was added at runtime. The library's components re-add theirs only when missing, so they just find
 * them there.
 */

/** The ids a style came with, before anything was added at runtime */
export interface StyleIds {
  sources: Set<string>
  layers: Set<string>
}

export function styleIds(style: Pick<Maplibre.StyleSpecification, 'sources' | 'layers'> | undefined): StyleIds {
  return {
    sources: new Set(Object.keys(style?.sources ?? {})),
    layers: new Set((style?.layers ?? []).map((l) => l.id)),
  }
}

/**
 * `next` with the runtime sources and layers of `previous` added: layers on top, in their order, unless `keep`
 * says no or the next style has the same id; sources unless the next style has one by that id (it wins, and
 * carried layers use it).
 */
export function carryRuntimeLayers(
  previous: Maplibre.StyleSpecification | undefined,
  next: Maplibre.StyleSpecification,
  own: StyleIds,
  keep: (layer: Maplibre.LayerSpecification) => boolean = () => true,
): Maplibre.StyleSpecification {
  if (!previous) return next
  const nextLayers = new Set(next.layers.map((l) => l.id))
  const layers = previous.layers.filter((l) => !own.layers.has(l.id) && !nextLayers.has(l.id) && keep(l))
  const sources = { ...next.sources }
  for (const [id, source] of Object.entries(previous.sources)) {
    if (!own.sources.has(id) && !(id in sources)) sources[id] = source
  }
  return { ...next, sources, layers: [...next.layers, ...layers] }
}
