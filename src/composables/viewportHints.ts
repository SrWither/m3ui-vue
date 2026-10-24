import { VIEWPORT_KEY, storageKey } from './_storageKeys'

/** A request's headers as server frameworks hand them over: a `Headers`, or a plain object (Node's, h3's). */
export type RequestHeaders = Headers | Record<string, string | string[] | undefined>

/** A window size, for `createM3UI({ initialState: { viewport } })` */
export interface ViewportSize {
  width: number
  height: number
}

/**
 * The client hints that carry the window's size (Chromium), for a server's `Accept-CH` and `Critical-CH` response
 * headers. With `Critical-CH`, Chromium repeats the very first request once to send them; later requests carry them
 * after `Accept-CH` alone.
 */
export const VIEWPORT_HINTS = 'Sec-CH-Viewport-Width, Sec-CH-Viewport-Height'

// Sizes standing for a kind of device when that's all a request tells: a phone (compact), a tablet held upright
// (medium), a laptop (large)
const GUESSES = {
  phone: { width: 412, height: 915 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1280, height: 800 },
} as const

function header(headers: RequestHeaders, name: string): string | undefined {
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.get(name) ?? undefined
  const record = headers as Record<string, string | string[] | undefined>
  const value = record[name] ?? record[Object.keys(record).find((k) => k.toLowerCase() === name) ?? '']
  return Array.isArray(value) ? value[0] : value
}

const size = (n: number) => Number.isFinite(n) && n > 0 && n < 20000

function fromCookie(cookies: string | undefined, prefix: string): ViewportSize | undefined {
  const raw = cookies?.match(new RegExp(`(?:^|;\\s*)${storageKey(VIEWPORT_KEY, prefix)}=([^;]*)`))?.[1]
  if (!raw) return undefined
  let value = raw
  try { value = decodeURIComponent(raw) } catch { /* as it is */ }
  const [width, height] = value.split('x').map(Number)
  return size(width!) && size(height!) ? { width: width!, height: height! } : undefined
}

/** The kind of device a request comes from: Chromium says whether it's mobile; otherwise the user agent */
function guess(headers: RequestHeaders): ViewportSize | undefined {
  const ua = header(headers, 'user-agent') ?? ''
  const mobileHint = header(headers, 'sec-ch-ua-mobile')
  // Chromium on an Android tablet says ?0 and leaves "Mobile" out of its user agent, so the hint goes first only for
  // phones
  if (mobileHint === '?1') return { ...GUESSES.phone }
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(ua)) return { ...GUESSES.tablet }
  if (mobileHint === '?0') return { ...GUESSES.desktop }
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return { ...GUESSES.phone }
  if (ua) return { ...GUESSES.desktop }
  return undefined
}

/**
 * The window size to server-render the adaptive layouts at, from a request's headers: the size `createM3UI({
 * cookies: true })` keeps in the `m3-viewport` cookie (any visit after the first); the viewport client hints
 * (Chromium, once the server asked for them with `VIEWPORT_HINTS`); or, on a first visit, a size standing for the
 * kind of device (`Sec-CH-UA-Mobile`, then the user agent: a phone, a tablet or a desktop), unless `guess: false`.
 * With `createM3UI({ storagePrefix })`, pass the same `storagePrefix` so the right cookie is read.
 * Undefined when nothing tells: the layouts then render compact.
 *
 * ```ts
 * createM3UI({ cookies: true, initialState: { viewport: viewportFromHeaders(request.headers) } })
 * ```
 */
export function viewportFromHeaders(headers: RequestHeaders, options: { guess?: boolean; storagePrefix?: string } = {}): ViewportSize | undefined {
  const cookie = fromCookie(header(headers, 'cookie'), options.storagePrefix ?? '')
  if (cookie) return cookie
  const width = Number(header(headers, 'sec-ch-viewport-width'))
  if (size(width)) {
    const height = Number(header(headers, 'sec-ch-viewport-height'))
    // Older Chromium sends only the width
    return { width, height: size(height) ? height : Math.round(width * (width < 600 ? 2.2 : 0.625)) }
  }
  return options.guess === false ? undefined : guess(headers)
}
