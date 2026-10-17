// Internal: keeps <meta name="theme-color"> (the browser bar / status bar color on phones) in sync with a color
// role of the active palette, dark mode and seed included. Started by createM3UI({ themeColor }).

let observer: MutationObserver | undefined
// useColorPalette's <style> for generated palettes
const PALETTE_STYLE_ID = 'm3-dynamic-palette'

function metas(): HTMLMetaElement[] {
  const found = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
  if (found.length) return found
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  document.head.appendChild(meta)
  return [meta]
}

function update(role: string) {
  const color = getComputedStyle(document.documentElement).getPropertyValue(`--color-${role}`).trim()
  if (!color) return
  for (const meta of metas()) {
    // A media-scoped pair (light/dark) would fight the live value: one meta, kept current, replaces them
    meta.removeAttribute('media')
    if (meta.content !== color) meta.content = color
  }
}

export function syncThemeColor(role: string) {
  if (typeof document === 'undefined') return
  observer?.disconnect()
  update(role)
  // Palette (data-palette), contrast (data-contrast) and dark mode (class) land on <html>; a generated palette
  // (a seed, or the same seed at another contrast) only rewrites the <style> it lives in, inside <head>
  const isPaletteStyle = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.id === PALETTE_STYLE_ID
  observer = new MutationObserver((records) => {
    if (records.some((r) => r.target === document.documentElement || isPaletteStyle(r.target)
      || Array.from(r.addedNodes).some(isPaletteStyle))) update(role)
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-palette', 'data-contrast'] })
  observer.observe(document.head, { childList: true, characterData: true, subtree: true })
}
