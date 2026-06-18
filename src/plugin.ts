import type { App } from 'vue'
import type { Palette } from './composables/useColorPalette'

export interface M3UIOptions {
  palette?: string
  customPalettes?: Palette[]
}

export function createM3UI(options: M3UIOptions = {}) {
  return {
    install(_app: App) {
      if (options.palette && options.palette !== 'purple') {
        document.documentElement.setAttribute('data-palette', options.palette)
        localStorage.setItem('m3-palette', options.palette)
      }
    },
  }
}
