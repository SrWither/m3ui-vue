import type { App, MaybeRef } from 'vue'
import type { Palette, PaletteId } from './composables/useColorPalette'
import { __defaultContrast, __defaultPalette, __defaultSeed, __forcePalette, palettes } from './composables/useColorPalette'
import type { ContrastLevel } from './composables/useColorPalette'
import type { SeedOptions } from './composables/dynamicColor'
import { syncThemeColor } from './composables/_themeColor'
import type { M3Locale } from './composables/useLocale'
import { M3_LOCALE_KEY, __setAppLocale } from './composables/useLocale'
import { vRipple } from './directives/vRipple'
import { M3_HYDRATING_KEY } from './composables/_hydration'
import { M3_INITIAL_STATE_KEY, enableCookies, writeCookie, type M3InitialState } from './composables/_ssrState'
import { THEME_KEY } from './composables/_storageKeys'
import type { Theme } from './composables/useTheme'
import { CONTRAST_KEY, PALETTE_KEY, SEED_PALETTE } from './composables/useColorPalette'

export interface M3UIOptions {
  palette?: PaletteId | (string & {})
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
  /**
   * Server-side rendering: tells the components whether the app is still hydrating the server's HTML (Nuxt's
   * `() => nuxtApp.isHydrating`, which `@m3ui-vue/nuxt` passes). The adaptive layouts (`MNavigationSuite`,
   * `MListDetail`, `MSupportingPane`) and `useWindowSizeClass()` then render their first frame at the server's size
   * (compact: it has no window) so it matches the HTML, and adapt once mounted.
   */
  isHydrating?: () => boolean
  /**
   * Also keep the theme, the palette and the contrast level in cookies (`m3-theme`, `m3-palette`, `m3-contrast`,
   * a year, `SameSite=Lax`), so a server can read them and render with the user's choice through `initialState`.
   */
  cookies?: boolean
  /**
   * Server-side rendering: the user's theme, palette and contrast as the server knows them (from the cookies that
   * `cookies` writes), on the server and on the client alike. `useTheme()` and `useColorPalette()` report them on
   * the server, and on the client while hydrating (with `isHydrating`), so what's rendered from them matches the
   * server's HTML. What's missing falls back to this plugin's defaults, like a first visit.
   */
  initialState?: M3InitialState
}

const THEMES: readonly Theme[] = ['light', 'dark', 'system']
const CONTRASTS: readonly string[] = ['standard', 'medium', 'high', 'system']

/** `initialState` with what it lacks (or holds invalid, cookies being user input) taken from the plugin's defaults,
 * by the same rules as the client: a stored choice wins unless `persistPalette` is false. */
function resolveInitialState(options: M3UIOptions): Required<M3InitialState> {
  const state = options.initialState ?? {}
  const forced = options.persistPalette === false
  const fallbackPalette = options.palette ?? (options.seed ? SEED_PALETTE : 'purple')
  const contrast = state.contrast && CONTRASTS.includes(state.contrast) ? state.contrast : undefined
  return {
    theme: state.theme && THEMES.includes(state.theme) ? state.theme : 'system',
    palette: forced ? fallbackPalette : state.palette || fallbackPalette,
    contrast: (forced && options.contrast) || contrast || options.contrast || 'standard',
  }
}

export function createM3UI(options: M3UIOptions = {}) {
  return {
    install(app: App) {
      app.directive('ripple', vRipple)
      if (options.isHydrating) app.provide(M3_HYDRATING_KEY, options.isHydrating)
      if (options.initialState) app.provide(M3_INITIAL_STATE_KEY, resolveInitialState(options))
      if (options.cookies && typeof window !== 'undefined') enableCookies()
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
        // Cookies for what's already stored (a user from before `cookies`, or the defaults just applied)
        if (options.cookies) {
          for (const key of [THEME_KEY, PALETTE_KEY, CONTRAST_KEY]) {
            let value: string | null = null
            try { value = localStorage.getItem(key) } catch { /* storage blocked */ }
            writeCookie(key, value)
          }
        }
      }
      if (options.locale) {
        app.provide(M3_LOCALE_KEY, options.locale)
        __setAppLocale(options.locale)
      }
    },
  }
}
