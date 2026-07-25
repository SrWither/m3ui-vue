import type { App, MaybeRef } from 'vue'
import type { Palette } from './composables/useColorPalette'
import type { M3Locale } from './composables/useLocale'
import { M3_LOCALE_KEY } from './composables/useLocale'

export interface M3UIOptions {
  palette?: string
  customPalettes?: Palette[]
  locale?: MaybeRef<Partial<M3Locale>>
}

export function createM3UI(options: M3UIOptions = {}) {
  return {
    install(app: App) {
      // `options.palette` is only the first-visit default — once the user picks a palette via
      // `useColorPalette().set()` it's persisted to localStorage, and that choice must win on
      // every later boot instead of being clobbered back to the plugin's static default.
      if (options.palette && options.palette !== 'purple' && !localStorage.getItem('m3-palette')) {
        document.documentElement.setAttribute('data-palette', options.palette)
        localStorage.setItem('m3-palette', options.palette)
      }
      if (options.locale) {
        app.provide(M3_LOCALE_KEY, options.locale)
      }
    },
  }
}
