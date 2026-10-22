// Internal: animates a theme change (dark mode, palette, contrast).
//
// Firefox (and any browser without @property) transitions six color properties on every element
// (`.theme-transitioning` in theme.css): smooth there, but in Chromium it recalculates every element's transitions
// each frame and stutters. Chromium and WebKit instead transition the color tokens themselves, once, on <html>:
// registered as <color> with @property they interpolate, and every element follows them through var(). Components'
// own color transitions (transition-colors) are turned off meanwhile, or they would restart on every frame of the
// token's change and trail behind the rest (the navbar and buttons did). A view transition was tried first: it
// cross-fades two snapshots, which looks washed out midway compared to the colors moving.

// The tokens of theme.css, palettes.css and generated palettes
const COLOR_TOKENS = [
  'background', 'on-background', 'surface', 'surface-dim', 'surface-bright', 'surface-variant', 'on-surface',
  'on-surface-variant', 'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest', 'inverse-surface', 'inverse-on-surface', 'inverse-primary',
  'outline', 'outline-variant', 'shadow', 'scrim',
  ...['primary', 'secondary', 'tertiary', 'error', 'success'].flatMap((c) => [c, `on-${c}`, `${c}-container`, `on-${c}-container`]),
  ...['primary', 'secondary', 'tertiary'].flatMap((c) => [`${c}-fixed`, `${c}-fixed-dim`, `on-${c}-fixed`, `on-${c}-fixed-variant`]),
].map((t) => `--color-${t}`)

const DURATION = 250
/** How long a theme switch's color transition takes, in ms (both paths) */
export const THEME_TRANSITION_MS = DURATION
const STYLE_ID = 'm3-theme-transition'

// Injected only while switching: a registered <color> computes to rgb(), and code reading a token with
// getPropertyValue() expects it as written
const css = COLOR_TOKENS.map((t) => `@property ${t} { syntax: '<color>'; inherits: true; initial-value: transparent; }`).join('\n')
  + `\nhtml.theme-switching { transition: ${COLOR_TOKENS.map((t) => `${t} ${DURATION}ms ease`).join(', ')}; }`
  + '\nhtml.theme-switching *, html.theme-switching *::before, html.theme-switching *::after { transition: none !important; }'

// Gecko: a CSS feature only it has, or its user agent ("Gecko/<version>" or "Firefox/"; Chromium and WebKit only
// say "like Gecko", and Firefox on iOS is WebKit and says "FxiOS")
const isGecko = () =>
  (typeof CSS !== 'undefined' && !!CSS.supports?.('-moz-appearance', 'none'))
  || (typeof navigator !== 'undefined' && /\bGecko\/\d|\bFirefox\//.test(navigator.userAgent))
const hasProperty = () => typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function'

let timer: ReturnType<typeof setTimeout> | undefined

/** Runs `apply` (the DOM writes of a theme change) with the theme transition. */
export function themeTransition(apply: () => void) {
  if (typeof document === 'undefined') return apply()
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) return apply()
  const root = document.documentElement

  if (!isGecko() && hasProperty()) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = css
      document.head.appendChild(style)
    }
    root.classList.add('theme-switching')
    // Style flush: the tokens' current values are computed as registered colors and the transition is in place
    // before they change
    void root.offsetHeight
    apply()
    clearTimeout(timer)
    timer = setTimeout(() => {
      root.classList.remove('theme-switching')
      document.getElementById(STYLE_ID)?.remove()
    }, DURATION + 50)
    return
  }

  root.classList.add('theme-transitioning')
  // Force a style flush so the transition is in place before the colors change
  void root.offsetHeight
  apply()
  setTimeout(() => root.classList.remove('theme-transitioning'), 300)
}
