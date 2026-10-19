import { computed, readonly, ref, watch, watchEffect } from 'vue'
import { generateScheme, schemeToCss, type SeedOptions } from './dynamicColor'
import { themeTransition } from './_themeTransition'

export interface Palette {
  id: string
  label: string
  /**
   * The palette's key color. A custom palette (`createM3UI({ customPalettes })`) with no CSS of its own gets its
   * scheme generated from it; one with `[data-palette='<id>']` rules keeps them.
   */
  seed: string
}

export const palettes: Palette[] = [
  { id: 'purple',      label: 'Purple',      seed: '#6750A4' },
  { id: 'indigo',      label: 'Indigo',      seed: '#4355B9' },
  { id: 'navy',        label: 'Navy',        seed: '#354BA0' },
  { id: 'blue',        label: 'Blue',        seed: '#005AC1' },
  { id: 'cyan',        label: 'Cyan',        seed: '#006874' },
  { id: 'teal',        label: 'Teal',        seed: '#006B5F' },
  { id: 'green',       label: 'Green',       seed: '#386A20' },
  { id: 'lime',        label: 'Lime',        seed: '#4C6706' },
  { id: 'olive',       label: 'Olive',       seed: '#636118' },
  { id: 'amber',       label: 'Amber',       seed: '#785900' },
  { id: 'sand',        label: 'Sand',        seed: '#715C2E' },
  { id: 'orange',      label: 'Orange',      seed: '#8B5000' },
  { id: 'deep-orange', label: 'Deep Orange', seed: '#96480A' },
  { id: 'brown',       label: 'Brown',       seed: '#6E4C32' },
  { id: 'red',         label: 'Red',         seed: '#B82000' },
  { id: 'coral',       label: 'Coral',       seed: '#A03530' },
  { id: 'crimson',     label: 'Crimson',     seed: '#9C4068' },
  { id: 'pink',        label: 'Pink',        seed: '#9C4057' },
  { id: 'violet',      label: 'Violet',      seed: '#7C39A4' },
  { id: 'slate',       label: 'Slate',       seed: '#4A6269' },
  { id: 'graphite',    label: 'Graphite',    seed: '#5C5C5C' },
  { id: 'charcoal',    label: 'Charcoal',    seed: '#3C3C3C' },
  { id: 'steel',       label: 'Steel',       seed: '#5A6A72' },
  { id: 'ash',         label: 'Ash',         seed: '#6B6560' },
  { id: 'iron',        label: 'Iron',        seed: '#505864' },
  { id: 'fog',         label: 'Fog',         seed: '#625E6E' },
  { id: 'pewter',      label: 'Pewter',      seed: '#5A6360' },
  { id: 'smoke',       label: 'Smoke',       seed: '#4D5C66' },
  { id: 'stone',       label: 'Stone',       seed: '#68635A' },
  { id: 'zinc',        label: 'Zinc',        seed: '#585B5E' },
  { id: 'monochrome',  label: 'Monochrome',  seed: '#000000' },
  { id: 'rust',        label: 'Rust',        seed: '#9C441E' },
  { id: 'gold',        label: 'Gold',        seed: '#715C00' },
  { id: 'emerald',     label: 'Emerald',     seed: '#006D39' },
  { id: 'turquoise',   label: 'Turquoise',   seed: '#006A68' },
  { id: 'cobalt',      label: 'Cobalt',      seed: '#006684' },
  { id: 'sapphire',    label: 'Sapphire',    seed: '#006399' },
  { id: 'amethyst',    label: 'Amethyst',    seed: '#5953AC' },
  { id: 'magenta',     label: 'Magenta',     seed: '#8D3F92' },
  { id: 'mauve',       label: 'Mauve',       seed: '#914277' },
]

// Ids whose CSS ships in palettes.css (plus 'purple', the theme.css baseline): never generated
const builtInIds = new Set(palettes.map((p) => p.id))

/** The palette id used while a seed color is active (`useColorPalette().setSeed()`). */
export const SEED_PALETTE = 'seed'

export interface ActiveSeed extends SeedOptions {
  seed: string
}

export const PALETTE_KEY = 'm3-palette'
const SEED_KEY = 'm3-seed'
export const CONTRAST_KEY = 'm3-contrast'
// The generated CSS of the active palette, so a reload applies it before the generator has loaded
export const CSS_KEY = 'm3-palette-css'

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key)
    return v == null ? null : (key === PALETTE_KEY || key === CONTRAST_KEY ? v : JSON.parse(v)) as T
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch { /* storage blocked */ }
}

const current = ref(read<string>(PALETTE_KEY) ?? 'purple')
const activeSeed = ref<ActiveSeed | null>(read<ActiveSeed>(SEED_KEY))

// ── Contrast ─────────────────────────────────────────────────────────────────────────────────────
/**
 * M3's contrast levels. `system` follows the OS (`prefers-contrast: more` → high). Built-in palettes need
 * `@m3ui-vue/m3ui-vue/palettes-contrast` imported for medium and high; seed palettes are regenerated.
 */
export type ContrastLevel = 'standard' | 'medium' | 'high' | 'system'
const CONTRAST_LEVELS: readonly ContrastLevel[] = ['standard', 'medium', 'high', 'system']
const storedContrast = read<string>(CONTRAST_KEY)
const contrast = ref<ContrastLevel>(CONTRAST_LEVELS.includes(storedContrast as ContrastLevel) ? storedContrast as ContrastLevel : 'standard')
const systemMore = ref(false)
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-contrast: more)')
  systemMore.value = mq.matches
  mq.addEventListener?.('change', (e) => { systemMore.value = e.matches })
}
/** The level in effect: `system` resolved to standard or high. */
const activeContrast = computed<Exclude<ContrastLevel, 'system'>>(() =>
  contrast.value === 'system' ? (systemMore.value ? 'high' : 'standard') : contrast.value)
const CONTRAST_AMOUNT = { standard: 0, medium: 0.5, high: 1 } as const

/** A seed's options with the active contrast level applied (standard keeps the seed's own `contrast`). */
function withContrast(seed: ActiveSeed): ActiveSeed {
  return activeContrast.value === 'standard' ? seed : { ...seed, contrast: CONTRAST_AMOUNT[activeContrast.value] }
}

function applyContrast(level: Exclude<ContrastLevel, 'system'>) {
  if (typeof document === 'undefined') return
  if (level === 'standard') document.documentElement.removeAttribute('data-contrast')
  else document.documentElement.setAttribute('data-contrast', level)
}

// Whether palette changes are written to localStorage. Defaults to true (existing behavior).
// An app can disable it via `createM3UI({ persistPalette: false })` or `useColorPalette().setPersistPalette(false)`
// so its chosen palette can't be overridden by a stored value on the next boot.
const persistEnabled = ref(true)

function applyAttribute(id: string) {
  if (typeof document === 'undefined') return
  if (id === 'purple') document.documentElement.removeAttribute('data-palette')
  else document.documentElement.setAttribute('data-palette', id)
}

// ── Generated palettes ──────────────────────────────────────────────────────────────────────────
// One <style> element holds the generated CSS of the active palette (a seed, or a custom palette
// without CSS of its own).

export const STYLE_ID = 'm3-dynamic-palette'

function injectCss(css: string) {
  if (typeof document === 'undefined') return
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

/** Whether a stylesheet (other than our generated one) already styles `[data-palette='<id>']`. */
function hasPaletteCss(id: string): boolean {
  if (typeof document === 'undefined') return false
  const needles = [`[data-palette="${id}"]`, `[data-palette='${id}']`, `[data-palette=${id}]`]
  const scan = (rules: CSSRuleList): boolean => {
    for (const rule of Array.from(rules)) {
      const selector = (rule as CSSStyleRule).selectorText
      if (selector && needles.some((n) => selector.includes(n))) return true
      const nested = (rule as CSSGroupingRule).cssRules
      if (nested && scan(nested)) return true
    }
    return false
  }
  for (const sheet of Array.from(document.styleSheets)) {
    if ((sheet.ownerNode as Element | null)?.id === STYLE_ID) continue
    try {
      if (scan(sheet.cssRules)) return true
    } catch { /* cross-origin sheet */ }
  }
  return false
}

let generation = 0

/** Generates the CSS for a palette id from a seed. Resolves null if a newer request won. */
async function generateCss(id: string, seed: ActiveSeed): Promise<string | null> {
  const mine = ++generation
  const options = withContrast(seed)
  const css = schemeToCss(await generateScheme(options.seed, options), id)
  return mine === generation ? css : null
}

/** Puts a generated palette's CSS in the page and caches it for the next load. */
function applyCss(id: string, css: string) {
  injectCss(css)
  if (persistEnabled.value) write(CSS_KEY, { id, css })
}

/** Switches to a palette id with the theme transition, injecting its generated CSS (if any) inside it. Applied
 * directly, not only through useColorPalette()'s watcher, so it also works when no component uses the composable
 * (createM3UI's defaults). */
function switchTo(id: string, css?: string) {
  if (persistEnabled.value) write(PALETTE_KEY, id)
  themeTransition(() => {
    if (css) applyCss(id, css)
    current.value = id
    applyAttribute(id)
  })
}

/** Picks a palette by id; a custom one with a seed and no CSS of its own is generated first. */
async function selectPalette(id: string) {
  generation++
  const custom = palettes.find((p) => p.id === id)
  if (custom && !builtInIds.has(id) && custom.seed && !hasPaletteCss(id)) {
    const css = await generateCss(id, { seed: custom.seed })
    if (css === null) return
    switchTo(id, css)
  } else switchTo(id)
}

/** Activates a seed color: generates its scheme and switches to it. */
async function selectSeed(seed: string, options: SeedOptions = {}) {
  const next: ActiveSeed = { seed, ...options }
  const css = await generateCss(SEED_PALETTE, next)
  if (css === null) return
  activeSeed.value = next
  if (persistEnabled.value) write(SEED_KEY, next)
  switchTo(SEED_PALETTE, css)
}

/** Sets the contrast level, with the theme transition; a generated palette (seed, custom) is regenerated. */
async function selectContrast(level: ContrastLevel, persist = persistEnabled.value) {
  contrast.value = level
  if (persist) write(CONTRAST_KEY, level)
}

// Applied on every change of the effective level (a setting or the OS preference), for every palette kind. A
// generated palette is regenerated first, then swapped in with the attribute in one transition.
watch(activeContrast, async () => {
  const id = current.value
  let css: string | null | undefined
  if (id === SEED_PALETTE && activeSeed.value) css = await generateCss(SEED_PALETTE, activeSeed.value)
  else {
    const custom = palettes.find((p) => p.id === id)
    if (custom && !builtInIds.has(id) && custom.seed && !hasPaletteCss(id)) css = await generateCss(id, { seed: custom.seed })
  }
  // A newer request (a palette, a seed, another level) superseded the generation: it generates at the active
  // level itself, but the attribute still has to follow
  themeTransition(() => {
    applyContrast(activeContrast.value)
    if (css) applyCss(id, css)
  })
})

export function useColorPalette() {
  watchEffect(() => {
    const id = current.value
    if (persistEnabled.value) write(PALETTE_KEY, id)
    applyAttribute(id)
  })

  /** Switches to a palette by id. */
  function set(id: string) {
    void selectPalette(id)
  }

  /**
   * Switches to a scheme generated from a seed color (Google's dynamic color: HCT, `tonal-spot` by default).
   * `palette` becomes `'seed'`. The last choice wins: `set(id)` afterwards switches back to that palette, and
   * `seed` keeps the last seed so a picker can offer it again.
   */
  function setSeed(seed: string, options?: SeedOptions) {
    return selectSeed(seed, options)
  }

  function setPersistPalette(enabled: boolean) {
    persistEnabled.value = enabled
    if (enabled) write(PALETTE_KEY, current.value)
  }

  /**
   * Sets M3's contrast level: `standard`, `medium`, `high`, or `system` (follows `prefers-contrast`). Built-in
   * palettes need `@m3ui-vue/m3ui-vue/palettes-contrast` imported; a seed palette is regenerated at that level.
   * Remembered like the palette.
   */
  function setContrast(level: ContrastLevel) {
    void selectContrast(level)
  }

  return {
    palette: current,
    palettes,
    set,
    seed: readonly(activeSeed),
    setSeed,
    contrast: readonly(contrast),
    activeContrast,
    setContrast,
    persistPalette: persistEnabled,
    setPersistPalette,
  }
}

// Apply on module load so the palette is visible before any component mounts, a generated one included (not on
// the server: the client does it when the module loads there)
if (typeof document !== 'undefined') {
  const saved = read<string>(PALETTE_KEY)
  const cached = read<{ id: string; css: string }>(CSS_KEY)
  if (saved && cached && cached.id === saved) injectCss(cached.css)
  if (saved && saved !== 'purple') document.documentElement.setAttribute('data-palette', saved)
  applyContrast(activeContrast.value)
}

/**
 * Internal: used by `createM3UI({ palette, persistPalette: false })` to force a palette on boot,
 * bypassing whatever is already in localStorage, without waiting for a component to call
 * `useColorPalette()` (which is what actually reacts to `current` via the watchEffect above).
 * Not exported from the package's public entry points.
 */
export function __forcePalette(id: string, persist: boolean) {
  persistEnabled.value = persist
  current.value = id
  applyAttribute(id)
  if (persist) write(PALETTE_KEY, id)
  if (palettes.some((p) => p.id === id) && !builtInIds.has(id)) void selectPalette(id)
}

/**
 * Internal: `createM3UI({ palette })`'s first-visit default. Sets `current` too, so a later `useColorPalette()`
 * doesn't write its stale initial value back over it.
 */
export function __defaultPalette(id: string) {
  current.value = id
  applyAttribute(id)
  write(PALETTE_KEY, id)
  if (palettes.some((p) => p.id === id) && !builtInIds.has(id)) void selectPalette(id)
}

/** Internal: `createM3UI({ seed })`. */
export function __defaultSeed(seed: string, options: SeedOptions | undefined, persist: boolean) {
  persistEnabled.value = persist
  return selectSeed(seed, options)
}

/** Internal: `createM3UI({ contrast })`, the first-visit default (or forced with `persistPalette: false`). */
export function __defaultContrast(level: ContrastLevel, persist: boolean) {
  if (persist && read<string>(CONTRAST_KEY)) return
  void selectContrast(level, persist)
}
