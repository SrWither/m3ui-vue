import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { STYLE_ID } from './_storageKeys'

/**
 * The current values of some color tokens (`['primary', 'surface']` → `--color-primary`…), kept up to date across
 * theme, palette and contrast changes: for what can't use CSS variables (a MapLibre layer's paint, a canvas). Empty
 * strings on the server.
 */
export function useThemeTokens<T extends string>(names: readonly T[]): Ref<Record<T, string>> {
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--color-${n}`).trim()])) as Record<T, string>
  }
  const tokens = ref(typeof document === 'undefined' ? Object.fromEntries(names.map((n) => [n, ''])) as Record<T, string> : read()) as Ref<Record<T, string>>
  let observer: MutationObserver | undefined
  let settle: ReturnType<typeof setTimeout> | undefined

  onMounted(() => {
    const update = () => {
      const next = read()
      if (names.some((n) => next[n] !== tokens.value[n])) tokens.value = next
    }
    // Dark mode (class), a palette or contrast (attributes), or a generated palette rewriting its <style> in <head>
    const isPaletteStyle = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.id === STYLE_ID
    observer = new MutationObserver((records) => {
      if (!records.some((r) => r.target === document.documentElement || isPaletteStyle(r.target)
        || Array.from(r.addedNodes).some(isPaletteStyle))) return
      update()
      // Chromium animates the tokens on a theme switch (_themeTransition, 250ms): read the settled values too
      clearTimeout(settle)
      settle = setTimeout(update, 300)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-palette', 'data-contrast'] })
    observer.observe(document.head, { childList: true, characterData: true, subtree: true })
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    clearTimeout(settle)
  })

  return tokens
}
