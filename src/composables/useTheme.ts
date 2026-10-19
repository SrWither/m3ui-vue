import { ref, watchEffect, onMounted, onUnmounted } from 'vue'
import { themeTransition } from './_themeTransition'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'm3-theme'

// No DOM on the server (SSR): nothing is read or applied there, the client does it when the module loads.
const inBrowser = typeof window !== 'undefined'

const theme = ref<Theme>((inBrowser ? localStorage.getItem(THEME_KEY) as Theme : null) ?? 'system')

let _appliedDark: boolean | null = null

function applyTheme(t: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = t === 'dark' || (t === 'system' && prefersDark)

  const isChange = _appliedDark !== null && _appliedDark !== isDark
  const apply = () => document.documentElement.classList.toggle('dark', isDark)
  if (isChange) themeTransition(apply)
  else apply()

  _appliedDark = isDark
}

// Apply immediately on module load (before any component mounts) — no animation
if (inBrowser) applyTheme(theme.value)

export function useTheme() {
  const mediaQuery = inBrowser ? window.matchMedia('(prefers-color-scheme: dark)') : null

  function onSystemChange() {
    if (theme.value === 'system') applyTheme('system')
  }

  watchEffect(() => {
    if (!inBrowser) return
    localStorage.setItem(THEME_KEY, theme.value)
    applyTheme(theme.value)
  })

  onMounted(() => mediaQuery?.addEventListener('change', onSystemChange))
  onUnmounted(() => mediaQuery?.removeEventListener('change', onSystemChange))

  function cycle() {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]!
  }

  return { theme, cycle }
}
