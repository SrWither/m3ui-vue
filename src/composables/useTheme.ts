import { ref, watchEffect, onMounted, onUnmounted } from 'vue'
import { themeTransition } from './_themeTransition'
import { initialState, readCookie, ssrValue, writeCookie } from './_ssrState'
import { THEME_KEY, onStoragePrefix, storageKey } from './_storageKeys'

export type Theme = 'light' | 'dark' | 'system'

export { THEME_KEY }

// No DOM on the server (SSR): nothing is read or applied there, the client does it when the module loads.
const inBrowser = typeof window !== 'undefined'

// localStorage, else the cookie createM3UI({ cookies }) keeps (cleared storage, or a theme a server set)
function readStored(): Theme {
  if (!inBrowser) return 'system'
  const key = storageKey(THEME_KEY)
  let v: string | null = null
  try { v = localStorage.getItem(key) } catch { /* storage blocked */ }
  return ((v ?? readCookie(key)) as Theme | null) ?? 'system'
}

const theme = ref<Theme>(readStored())

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

// createM3UI({ storagePrefix }): this app's own stored theme, applied before anything renders — no animation
onStoragePrefix(() => {
  if (!inBrowser) return
  theme.value = readStored()
  _appliedDark = null
  applyTheme(theme.value)
})

export function useTheme() {
  const mediaQuery = inBrowser ? window.matchMedia('(prefers-color-scheme: dark)') : null

  function onSystemChange() {
    if (theme.value === 'system') applyTheme('system')
  }

  watchEffect(() => {
    if (!inBrowser) return
    const key = storageKey(THEME_KEY)
    try { localStorage.setItem(key, theme.value) } catch { /* storage blocked */ }
    writeCookie(key, theme.value)
    applyTheme(theme.value)
  })

  onMounted(() => mediaQuery?.addEventListener('change', onSystemChange))
  onUnmounted(() => mediaQuery?.removeEventListener('change', onSystemChange))

  function cycle() {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]!
  }

  // Server-side rendering with `createM3UI({ initialState })`: the user's theme as the server knows it
  return { theme: ssrValue(theme, initialState()?.theme), cycle }
}
