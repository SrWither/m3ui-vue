import type { App, MaybeRef } from 'vue'
import type { Palette } from './composables/useColorPalette'
import { __forcePalette } from './composables/useColorPalette'
import type { M3Locale } from './composables/useLocale'
import { M3_LOCALE_KEY } from './composables/useLocale'

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
  customPalettes?: Palette[]
  locale?: MaybeRef<Partial<M3Locale>>
}

export function createM3UI(options: M3UIOptions = {}) {
  return {
    install(app: App) {
      if (options.persistPalette === false) {
        if (options.palette) __forcePalette(options.palette, false)
      } else if (options.palette && options.palette !== 'purple' && !localStorage.getItem('m3-palette')) {
        // `options.palette` is only the first-visit default — once the user picks a palette via
        // `useColorPalette().set()` it's persisted to localStorage, and that choice must win on
        // every later boot instead of being clobbered back to the plugin's static default.
        document.documentElement.setAttribute('data-palette', options.palette)
        localStorage.setItem('m3-palette', options.palette)
      }
      if (options.locale) {
        app.provide(M3_LOCALE_KEY, options.locale)
      }
    },
  }
}
