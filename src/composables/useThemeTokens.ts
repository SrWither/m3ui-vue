import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { STYLE_ID } from './_storageKeys'
import { THEME_TRANSITION_MS } from './_themeTransition'
import { cubicBezier } from './motion'

export interface ThemeTokensOptions {
  /**
   * Updates every animation frame while the theme switch's colors fade, so a canvas redrawn on change fades with
   * the page instead of jumping to the new colors. Off by default: what animates color changes itself (Chart.js,
   * MChart, maps) only needs the final values, and would otherwise redraw ~15 times per switch.
   */
  live?: boolean
}

// The CSS `ease` the switch uses (_themeTransition.ts, and `.theme-transitioning` in theme.css)
const ease = cubicBezier(0.25, 0.1, 0.25, 1)

type Rgba = [number, number, number, number]

// Hex (#rgb, #rgba, #rrggbb, #rrggbbaa) or rgb()/rgba(), the forms tokens are written in or computed to; null for
// anything else (that token then switches at once)
function parseColor(value: string): Rgba | null {
  const v = value.trim()
  const hex = /^#([0-9a-f]{3,8})$/i.exec(v)?.[1]
  if (hex && hex.length !== 5 && hex.length !== 7) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1]
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(v)?.[1]
  if (!fn) return null
  const parts = fn.split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const channel = (p: string) => (p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p))
  const alpha = parts[3] == null ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
  const rgba = [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!), alpha] as Rgba
  return rgba.every(Number.isFinite) ? rgba : null
}

function mix(from: string, to: string, t: number): string {
  const a = parseColor(from)
  const b = parseColor(to)
  if (!a || !b) return t < 1 ? from : to
  const [r, g, bl, al] = a.map((x, i) => x + (b[i]! - x) * t)
  return `rgba(${Math.round(r!)}, ${Math.round(g!)}, ${Math.round(bl!)}, ${+al!.toFixed(3)})`
}

/**
 * The current values of some color tokens (`['primary', 'surface']` → `--color-primary`…), kept up to date across
 * light/dark, palette, contrast and generated (seed) palette changes: for what can't use CSS variables, like a
 * Chart.js dataset, a canvas or a MapLibre layer's paint. Values settle after the theme switch's color transition;
 * with `{ live: true }` they also follow it frame by frame (as `rgba()` midway). Empty strings on the server.
 *
 * ```ts
 * const colors = useThemeTokens(['primary', 'tertiary', 'outline-variant'] as const)
 * const data = computed(() => ({ datasets: [{ data: sales, borderColor: colors.value.primary }] }))
 * ```
 */
export function useThemeTokens<T extends string>(names: readonly T[], options: ThemeTokensOptions = {}): Ref<Record<T, string>> {
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--color-${n}`).trim()])) as Record<T, string>
  }
  const tokens = ref(typeof document === 'undefined' ? Object.fromEntries(names.map((n) => [n, ''])) as Record<T, string> : read()) as Ref<Record<T, string>>
  let observer: MutationObserver | undefined
  let settle: ReturnType<typeof setTimeout> | undefined
  let frame = 0

  const set = (next: Record<T, string>) => {
    if (names.some((n) => next[n] !== tokens.value[n])) tokens.value = next
  }
  const update = () => set(read())

  // Follows a switch already under way. Chromium/WebKit animate the tokens themselves (`theme-switching`), so
  // reading them each frame gives the page's own colors; Firefox fades each element's colors instead
  // (`theme-transitioning`) while the tokens jump, so the same `ease` is replayed here from the old values
  function follow(root: HTMLElement) {
    cancelAnimationFrame(frame)
    const native = root.classList.contains('theme-switching')
    const from = { ...tokens.value }
    const to = native ? null : read()
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / THEME_TRANSITION_MS)
      // The last frame lands on the values as written, not their rgba() form
      if (to) set(t < 1 ? Object.fromEntries(names.map((n) => [n, mix(from[n], to[n], ease(t))])) as Record<T, string> : to)
      else update()
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  onMounted(() => {
    const root = document.documentElement
    // Dark mode (class), a palette or contrast (attributes), or a generated palette rewriting its <style> in <head>
    const isPaletteStyle = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.id === STYLE_ID
    observer = new MutationObserver((records) => {
      if (!records.some((r) => r.target === root || isPaletteStyle(r.target)
        || Array.from(r.addedNodes).some(isPaletteStyle))) return
      if (options.live && (root.classList.contains('theme-switching') || root.classList.contains('theme-transitioning'))) follow(root)
      else update()
      // Chromium animates the tokens on a theme switch (_themeTransition, 250ms): read the settled values too
      clearTimeout(settle)
      settle = setTimeout(update, THEME_TRANSITION_MS + 50)
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-palette', 'data-contrast'] })
    observer.observe(document.head, { childList: true, characterData: true, subtree: true })
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    clearTimeout(settle)
    cancelAnimationFrame(frame)
  })

  return tokens
}
