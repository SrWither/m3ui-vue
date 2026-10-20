/** A place found by a `MapSearchProvider`. */
export interface MapSearchResult {
  /** What to show */
  label: string
  /** Where it is */
  lngLat: [number, number]
  /** Its extent, `[west, south, east, north]`: the map fits it instead of zooming to the point */
  bbox?: [number, number, number, number]
  /** Its kind (`city`, `road`, `park`, `restaurant`…), for the icon */
  type?: string
}

/** Finds places for `MMapSearch`: the text in, results out. `signal` aborts a search the user replaced. */
export type MapSearchProvider = (query: string, signal: AbortSignal) => Promise<MapSearchResult[]>

export interface NominatimOptions {
  /** The Nominatim server (`https://nominatim.openstreetmap.org` by default; mind its usage policy, or run your own) */
  url?: string
  /** How many results (6) */
  limit?: number
  /** The results' language (`es`, `en`…); by default the page's (`<html lang>`) */
  language?: string
  /** Only these countries (ISO codes: `['ar']`) */
  countryCodes?: string[]
  /** Prefer (or with `bounded`, only) this area: `[west, south, east, north]` */
  viewbox?: [number, number, number, number]
  bounded?: boolean
}

/**
 * OpenStreetMap's Nominatim geocoder. Its public server allows one search per second and no search-as-you-type:
 * `MMapSearch` searches on Enter.
 */
export function nominatimProvider(options: NominatimOptions = {}): MapSearchProvider {
  return async (query, signal) => {
    const params = new URLSearchParams({ format: 'jsonv2', q: query, limit: String(options.limit ?? 6) })
    const language = options.language ?? (typeof document !== 'undefined' ? document.documentElement.lang : '')
    if (language) params.set('accept-language', language)
    if (options.countryCodes?.length) params.set('countrycodes', options.countryCodes.join(','))
    if (options.viewbox) params.set('viewbox', options.viewbox.join(','))
    if (options.bounded) params.set('bounded', '1')
    const res = await fetch(`${options.url ?? 'https://nominatim.openstreetmap.org'}/search?${params}`, { signal })
    if (!res.ok) throw new Error(`Nominatim: ${res.status}`)
    const data = await res.json() as { display_name: string; lat: string; lon: string; type?: string; boundingbox?: string[] }[]
    return data.map((r) => {
      // Nominatim's boundingbox is [south, north, west, east]
      const b = r.boundingbox?.map(Number)
      return {
        label: r.display_name,
        lngLat: [Number(r.lon), Number(r.lat)] as [number, number],
        bbox: b && b.length === 4 ? [b[2]!, b[0]!, b[3]!, b[1]!] as [number, number, number, number] : undefined,
        type: r.type,
      }
    })
  }
}
