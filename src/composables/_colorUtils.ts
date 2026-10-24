// Internal color math shared by MColorPicker and MColorPickerModal (through _MColorPanel).
// Not exported from index.ts.
import { ref } from 'vue'
import { onStoragePrefix, storageKey } from './_storageKeys'

export interface Rgba { r: number; g: number; b: number; a: number }
/** h 0–360, s/v 0–100 */
export interface Hsv { h: number; s: number; v: number }
/** h 0–360, s/l 0–100 */
export interface Hsl { h: number; s: number; l: number }

/** Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (the `#` is optional). r/g/b 0–255, a 0–1. */
export function parseHex(input: string): Rgba | null {
  let c = input.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return null
  if (c.length <= 4) c = [...c].map((ch) => ch + ch).join('')
  const n = (i: number) => parseInt(c.substring(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: c.length === 8 ? n(6) / 255 : 1 }
}

/** `#rrggbb`, or `#rrggbbaa` when a < 1. Lowercase. */
export function toHex({ r, g, b, a }: Rgba): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a * 255) : ''}`
}

/** Lowercase canonical form of a hex string, or '' when it isn't one. */
export function normalizeHex(input: string): string {
  const c = parseHex(input)
  return c ? toHex(c) : ''
}

export function rgbToHsv({ r, g, b }: Rgba): Hsv {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

export function hsvToRgb({ h, s, v }: Hsv, a = 1): Rgba {
  s /= 100; v /= 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255
  }
  return { r: f(5), g: f(3), b: f(1), a }
}

export function hsvToHsl({ h, s, v }: Hsv): Hsl {
  s /= 100; v /= 100
  const l = v * (1 - s / 2)
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)
  return { h, s: sl * 100, l: l * 100 }
}

export function hslToHsv({ h, s, l }: Hsl): Hsv {
  s /= 100; l /= 100
  const v = l + s * Math.min(l, 1 - l)
  return { h, s: v === 0 ? 0 : 2 * (1 - l / v) * 100, v: v * 100 }
}

/** Black or white, whichever reads better on the color (WCAG relative luminance). */
export function inkFor(hex: string): '#000000' | '#ffffff' {
  const c = parseHex(hex)
  if (!c) return '#000000'
  const lin = (n: number) => {
    n /= 255
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  // Contrast against black beats contrast against white above ~0.179
  return lum > 0.179 ? '#000000' : '#ffffff'
}

// ── Recent colors (per viewer, localStorage, shared by every picker on the page) ──────────────

const RECENT_KEY = 'm3-color-recent'

function readRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(RECENT_KEY)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!parseHex(x)) : []
  } catch {
    return []
  }
}

export const recentColors = ref<string[]>(readRecents())
onStoragePrefix(() => { recentColors.value = readRecents() })

export function pushRecentColor(hex: string, limit: number) {
  const c = normalizeHex(hex)
  if (!c) return
  recentColors.value = [c, ...recentColors.value.filter((x) => x !== c)].slice(0, Math.max(limit, 0))
  try { localStorage.setItem(storageKey(RECENT_KEY), JSON.stringify(recentColors.value)) } catch { /* storage blocked */ }
}

/** Default swatches for both pickers: the Material 2014 palette's 500 tones plus grey, black and white (3 rows of 7) */
export const defaultColorPresets = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4',
  '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
  '#ff9800', '#ff5722', '#795548', '#607d8b', '#9e9e9e', '#000000', '#ffffff',
]
