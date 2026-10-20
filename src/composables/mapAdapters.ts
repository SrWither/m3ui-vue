import type * as Maplibre from 'maplibre-gl'

/** How to show one property of a feature. */
export interface MapFieldFormat {
  /** The label (the key, capitalized, by default) */
  label?: string
  /** Text before the value */
  prefix?: string
  /** Text after the value */
  suffix?: string
  /** A number mask: its decimals set the fraction digits (`#.00` → 2) and a comma turns on grouping (`#,###`) */
  mask?: string
  /** Leave it out */
  hidden?: boolean
}

/** One layer of the style, as the map's UI components see it. */
export interface MapLayerInfo {
  /** The style layer's id */
  id: string
  /** Its name in the UI */
  title: string
  description?: string
  /** The `name` of its group in `MapLayerModel.groups` */
  group?: string
  /** Shown in `MMapLayers` */
  listed: boolean
  /** A base layer: `MMapBaseLayers` shows one of them at a time, with this thumbnail */
  base?: { image?: string }
  /** Layer ids shown, hidden and faded along with it */
  children: string[]
  /** Listed by `MMapIdentify` on click: every property, formatted by `format`, minus `exclude` */
  identify: false | { format: Record<string, MapFieldFormat>; exclude: string[] }
  /** Shown by `MMapHover` under the pointer: these properties, in order */
  hover: false | { fields: (MapFieldFormat & { key: string })[] }
  /** A legend image URL (an SVG, typically) */
  legend?: string
  /** A download URL for its data */
  download?: string
}

/** The style as the map's UI components see it: layers with names, groups, base layers, what to identify. */
export interface MapLayerModel {
  /** The style's name */
  title?: string
  /** Groups, in order */
  groups: { name: string; title: string }[]
  /** Layers, in the style's order (bottom to top) */
  layers: MapLayerInfo[]
}

/** What an adapter gets besides the style. */
export interface MapAdapterContext {
  /** The style's URL, when `MMap`'s `mapStyle` is one */
  styleUrl?: string
}

/** Reads a style's conventions (usually its `metadata`) into the model the map's UI components use. */
export type MapAdapter = (style: Maplibre.StyleSpecification, context: MapAdapterContext) => MapLayerModel

type Metadata = Record<string, unknown> | undefined
const meta = (layer: { metadata?: unknown }) => layer.metadata as Metadata
const VECTOR = new Set(['fill', 'line', 'circle', 'symbol', 'fill-extrusion', 'heatmap'])

/**
 * Any style: every layer but the background is listed under its id (or `metadata.title`), vector layers identify all
 * their properties, and nothing is a base layer or shows on hover.
 */
export const genericAdapter: MapAdapter = (style) => ({
  title: style.name,
  groups: [],
  layers: style.layers
    .filter((l) => l.type !== 'background')
    .map((l) => ({
      id: l.id,
      title: (meta(l)?.title as string | undefined) ?? l.id,
      listed: true,
      children: [],
      identify: VECTOR.has(l.type) ? { format: {}, exclude: [] } : false,
      hover: false,
    })),
})

export interface OrvianAdapterOptions {
  /**
   * A layer's legend image. By default, for a style served by mvt-rs (`…/services/styles/<style>`), its legend service
   * (`…/services/legends/<style>?layer_id=<id>`), unless the layer's `metadata.legend.show` is false;
   * `metadata.legend.wmslegend` overrides it
   */
  legend?: (layer: Maplibre.LayerSpecification, styleUrl?: string) => string | undefined
}

/**
 * The Orvian viewers' conventions in the style's `metadata`. On each layer: `alias`, `description`, `group`,
 * `show_in_layerlist` (false hides it from the list), `isbaselayer` with `image` (raster base layers), `childs` (layer
 * ids toggled with it), `identify` (true lists its properties on click), `fields` (per property: `alias`, `prefix`,
 * `suffix`, `mask`, `show: false`; plus `exclude`, a list of properties to leave out), `hover` (`enable` and `fields`,
 * a list of `{ <property>: { alias, prefix, suffix, mask } }`), `legend` (`show`, `wmslegend`) and `download`. On the
 * style: `groups` (`{ name, alias }`, in order).
 */
export function orvianAdapter(options: OrvianAdapterOptions = {}): MapAdapter {
  const legendOf = options.legend ?? ((layer, styleUrl) => {
    const legend = meta(layer)?.legend as { show?: boolean; wmslegend?: string } | undefined
    if (legend?.show === false) return undefined
    if (legend?.wmslegend) return legend.wmslegend
    if (!styleUrl?.includes('/services/styles/')) return undefined
    const url = styleUrl.replace('/services/styles/', '/services/legends/')
    return `${url}${url.includes('?') ? '&' : '?'}has_label=false&include_raster=true&layer_id=${encodeURIComponent(layer.id)}`
  })

  return (style, { styleUrl }) => {
    const groups = ((style.metadata as Metadata)?.groups as { name: string; alias?: string }[] | undefined) ?? []
    return {
      title: style.name,
      groups: groups.map((g) => ({ name: g.name, title: g.alias ?? g.name })),
      layers: style.layers
        .filter((l) => l.type !== 'background')
        .map((l) => {
          const m = meta(l) ?? {}
          const fields = { ...(m.fields as Record<string, unknown> | undefined) }
          const exclude = (fields.exclude as string[] | undefined) ?? []
          delete fields.exclude
          const format: Record<string, MapFieldFormat> = {}
          for (const [key, f] of Object.entries(fields as Record<string, { alias?: string; prefix?: string; suffix?: string; mask?: string; show?: boolean }>)) {
            format[key] = { label: f.alias, prefix: f.prefix, suffix: f.suffix, mask: f.mask, hidden: f.show === false }
          }
          const hover = m.hover as { enable?: boolean; fields?: Record<string, MapFieldFormat & { alias?: string }>[] } | undefined
          const base = l.type === 'raster' && m.isbaselayer === true
          return {
            id: l.id,
            title: (m.alias as string | undefined) ?? l.id,
            description: m.description as string | undefined,
            group: m.group as string | undefined,
            listed: !base && m.show_in_layerlist !== false,
            base: base && m.show_in_layerlist !== false ? { image: m.image as string | undefined } : undefined,
            children: Array.isArray(m.childs) ? (m.childs as string[]) : [],
            identify: m.identify === true ? { format, exclude } : false,
            hover: hover?.enable
              ? {
                  fields: (hover.fields ?? []).flatMap((entry) =>
                    Object.entries(entry).map(([key, f]) => ({ key, label: f.alias ?? f.label, prefix: f.prefix, suffix: f.suffix, mask: f.mask }))),
                }
              : false,
            legend: base ? undefined : legendOf(l, styleUrl),
            download: l.type !== 'raster' ? (m.download as string | undefined) : undefined,
          } satisfies MapLayerInfo
        }),
    }
  }
}

/** A property's label: its format's, or the key with a capital first letter. */
export function fieldLabel(key: string, format?: MapFieldFormat): string {
  return format?.label ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * A property's value as text: numbers through `mask` (in the page's language, `<html lang>`), then `prefix` and
 * `suffix`. Empty values give ''.
 */
export function formatFieldValue(raw: unknown, format?: MapFieldFormat): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') return ''
  let value = String(raw)
  const num = typeof raw === 'number' ? raw : Number(raw)
  if (format?.mask && !Number.isNaN(num)) {
    const decimals = format.mask.split('.')[1]?.length ?? 0
    const lang = typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined
    value = new Intl.NumberFormat(lang, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: format.mask.includes(','),
    }).format(num)
  }
  if (format?.prefix) value = `${format.prefix} ${value}`
  if (format?.suffix) value = `${value} ${format.suffix}`
  return value
}

/** What `MMapIdentify` found on one layer at a point. */
export interface MapIdentifyResult {
  layer: MapLayerInfo
  feature: Maplibre.MapGeoJSONFeature
  /** Its properties as the layer's `identify` shows them, formatted */
  fields: { key: string; label: string; value: string }[]
}

// Keys MapLibre or a previous identify adds to a feature's properties
const INTERNAL_KEYS = new Set(['coordinates', 'mapCoordinates', 'layerId', '__layerMetadata'])

/**
 * The features of the model's identify layers at a point (topmost first), with their properties formatted: what
 * `MMapIdentify` lists on click, for a UI of your own.
 */
export function identifyFeatures(map: Maplibre.Map, point: Maplibre.PointLike, model: MapLayerModel | undefined): MapIdentifyResult[] {
  const layers = new Map((model?.layers ?? []).filter((l) => l.identify && map.getLayer(l.id)).map((l) => [l.id, l]))
  if (!layers.size) return []
  const results: MapIdentifyResult[] = []
  for (const feature of map.queryRenderedFeatures(point, { layers: [...layers.keys()] })) {
    const layer = layers.get(feature.layer.id)
    if (!layer || !layer.identify) continue
    const { format, exclude } = layer.identify
    const fields = Object.entries(feature.properties ?? {})
      .filter(([key]) => !INTERNAL_KEYS.has(key) && !exclude.includes(key) && !format[key]?.hidden)
      .map(([key, raw]) => ({ key, label: fieldLabel(key, format[key]), value: formatFieldValue(raw, format[key]) }))
    if (fields.length) results.push({ layer, feature, fields })
  }
  return results
}
