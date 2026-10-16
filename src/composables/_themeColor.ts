// Internal: keeps <meta name="theme-color"> (the browser bar / status bar color on phones) in sync with a color
// role of the active palette, dark mode and seed included. Started by createM3UI({ themeColor }).

let observer: MutationObserver | undefined

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
  // Palette (data-palette), dark mode and palette switches (class: dark, theme-transitioning) all land on <html>;
  // a new seed also toggles theme-transitioning, after its CSS is in place
  observer = new MutationObserver(() => update(role))
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-palette'] })
}
