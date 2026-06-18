import { ref, watchEffect, onMounted, onUnmounted } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>((localStorage.getItem('m3-theme') as Theme) ?? 'system')

let _appliedDark: boolean | null = null

function applyTheme(t: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = t === 'dark' || (t === 'system' && prefersDark)

  const isChange = _appliedDark !== null && _appliedDark !== isDark

  if (isChange) {
    // Force reflow so transition property takes effect before the color change
    document.documentElement.classList.add('theme-transitioning')
    void document.documentElement.offsetHeight
  }

  document.documentElement.classList.toggle('dark', isDark)

  if (isChange) {
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 300)
  }

  _appliedDark = isDark
}

// Apply immediately on module load (before any component mounts) — no animation
applyTheme(theme.value)

export function useTheme() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function onSystemChange() {
    if (theme.value === 'system') applyTheme('system')
  }

  watchEffect(() => {
    localStorage.setItem('m3-theme', theme.value)
    applyTheme(theme.value)
  })

  onMounted(() => mediaQuery.addEventListener('change', onSystemChange))
  onUnmounted(() => mediaQuery.removeEventListener('change', onSystemChange))

  function cycle() {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]!
  }

  return { theme, cycle }
}
