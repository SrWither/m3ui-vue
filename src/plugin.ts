import type { App, MaybeRef } from 'vue'
import type { Palette } from './composables/useColorPalette'
import { __defaultContrast, __defaultPalette, __defaultSeed, __forcePalette, palettes } from './composables/useColorPalette'
import type { ContrastLevel } from './composables/useColorPalette'
import type { SeedOptions } from './composables/dynamicColor'
import { syncThemeColor } from './composables/_themeColor'
import type { M3Locale } from './composables/useLocale'
import { M3_LOCALE_KEY, __setAppLocale } from './composables/useLocale'
import { vRipple } from './directives/vRipple'

export interface M3UIOptions {
  palette?: string
  /**
   * Set to `false` to make `palette` a hard default that always wins on boot, ignoring
   * whatever is already stored in localStorage, and to stop future `useColorPalette().set()`
   * calls from persisting either. Palette switching still works live within the session
   * (`set()` still applies immediately) — only the "remember it for next time" part is disabled.
   * Defaults to `true`, matching prior behavior (`palette` only seeds the very first visit,
   * and any later choice persists and wins over it).
   */
  persistPalette?: boolean
  /**
   * Palettes of your own, added to `useColorPalette().palettes` so palette pickers built from
   * that list show them. An entry whose `id` matches a built-in palette replaces it. Each one
   * still needs its CSS: `[data-palette='<id>'] { --color-primary: ...; }` plus a
   * `[data-palette='<id>'].dark { ... }` block, overriding the same tokens as `palettes.css`.
   */
  customPalettes?: Palette[]
  /**
   * Generate the whole color scheme (light and dark) from one color instead of using a named palette: Google's
   * dynamic color, the way Android builds a theme from a wallpaper. `palette` wins when both are given, and like
   * `palette` it's only the first-visit default unless `persistPalette` is `false`.
   */
  seed?: string
  /** How `seed` becomes a scheme: `variant` (`'tonal-spot'` by default) and `contrast` (0 standard, 0.5 medium, 1 high). */
  seedOptions?: SeedOptions
  /**
   * M3's contrast level: `'standard'`, `'medium'`, `'high'`, or `'system'` (follows the OS's `prefers-contrast`).
   * Like `palette`, only the first-visit default unless `persistPalette` is `false`. Built-in palettes need
   * `@m3ui-vue/m3ui-vue/palettes-contrast` imported for medium and high; seed palettes are regenerated.
   */
  contrast?: ContrastLevel
  locale?: MaybeRef<Partial<M3Locale>>
  /**
   * Keep `<meta name="theme-color">` (the color phones give the browser bar and status bar) in sync with a color
   * role of the active palette, following palette, seed and dark mode changes. `'surface'` matches a top app
   * bar, as Material apps on Android do; any role name works (`'primary'`, `'surface-container'`…). Off by default:
   * when set, the library owns that meta (it's created if missing, and a light/dark `media` pair becomes one).
   * Note that Chrome and Samsung Internet on Android ignore it in a regular tab while the system is in dark
   * mode (they keep their own dark bar); installed apps (PWA) still get it.
   */
  themeColor?: 'surface' | 'surface-container' | 'primary' | (string & {})
}

export function createM3UI(options: M3UIOptions = {}) {
  return {
    install(app: App) {
      app.directive('ripple', vRipple)
      for (const custom of options.customPalettes ?? []) {
        const i = palettes.findIndex((p) => p.id === custom.id)
        if (i === -1) palettes.push(custom)
        else palettes[i] = custom
      }
      // Palette, seed, contrast and theme-color live on the page and in localStorage: on the server (SSR) there's
      // neither, and the client applies them when it installs the plugin
      if (typeof window !== 'undefined') {
        if (options.persistPalette === false) {
          if (options.palette) __forcePalette(options.palette, false)
          else if (options.seed) void __defaultSeed(options.seed, options.seedOptions, false)
        } else if (!localStorage.getItem('m3-palette')) {
          // `palette`/`seed` are only the first-visit default — once the user picks a palette via
          // `useColorPalette().set()` (or a seed via `setSeed()`) it's persisted to localStorage, and that choice
          // must win on every later boot instead of being clobbered back to the plugin's static default.
          if (options.palette && options.palette !== 'purple') __defaultPalette(options.palette)
          else if (!options.palette && options.seed) void __defaultSeed(options.seed, options.seedOptions, true)
        }
        if (options.contrast) __defaultContrast(options.contrast, options.persistPalette !== false)
        if (options.themeColor) syncThemeColor(options.themeColor)
      }
      if (options.locale) {
        app.provide(M3_LOCALE_KEY, options.locale)
        __setAppLocale(options.locale)
      }
    },
  }
}
