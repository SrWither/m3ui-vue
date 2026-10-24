// Storage keys shared with modules that must not load useTheme (it applies the theme to <html> when it loads)
export const THEME_KEY = 'm3-theme'
// The <style> useColorPalette writes a generated palette's CSS into
export const STYLE_ID = 'm3-dynamic-palette'
// The window's size, a cookie only (createM3UI({ cookies: true })): `<width>x<height>`
export const VIEWPORT_KEY = 'm3-viewport'

// ── Prefix ──────────────────────────────────────────────────────────────────────────────────────
// `createM3UI({ storagePrefix: 'admin' })`: every key the library stores (localStorage and cookies) becomes
// `admin-m3-…`, so apps on the same origin under different paths keep their own theme, palette and the rest
// (localStorage is per origin and our cookies are on `Path=/`, so without it they share one).

let prefix = ''
const reloaders = new Set<() => void>()

/** The name a key is stored under: the base key with the app's prefix, if any. */
export function storageKey(base: string, storagePrefix = prefix): string {
  return storagePrefix ? `${storagePrefix}-${base}` : base
}

/**
 * Sets the prefix and has every module that read its stored state on load (theme, palette, recent colors…) read
 * it again under the new keys. `createM3UI` calls it before applying anything else.
 */
export function setStoragePrefix(next: string) {
  if (next === prefix) return
  prefix = next
  for (const reload of reloaders) reload()
}

/** Registers what a module does to read its stored state again when the prefix changes. */
export function onStoragePrefix(reload: () => void) {
  reloaders.add(reload)
}
