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
      if (options.palette && options.palette !== 'purple') {
        document.documentElement.setAttribute('data-palette', options.palette)
        localStorage.setItem('m3-palette', options.palette)
      }
      if (options.locale) {
        app.provide(M3_LOCALE_KEY, options.locale)
      }
    },
  }
}
