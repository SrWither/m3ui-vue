/**
 * Prints one element on its own: copies it with the page's stylesheets into a hidden iframe and prints that frame,
 * so the rest of the page (navigation, other content) never reaches the paper. Always prints the light theme.
 * Internal: used by MReceipt and MCertificate.
 */
export function printElement(el: HTMLElement, { page, css = '' }: { page: string; css?: string }) {
  if (typeof document === 'undefined') return
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) return frame.remove()
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((n) => n.outerHTML)
    .join('')
  const html = document.documentElement
  const palette = html.getAttribute('data-palette')
  doc.open()
  doc.write(
    `<!doctype html><html class="${html.className.replace(/\bdark\b/, '')}"${palette ? ` data-palette="${palette}"` : ''}>` +
      `<head><meta charset="utf-8"><base href="${document.baseURI}">${styles}` +
      `<style>@page{size:${page};margin:0}html,body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}${css}</style>` +
      `</head><body>${el.outerHTML}</body></html>`,
  )
  doc.close()
  const go = () => {
    win.focus()
    win.print()
    setTimeout(() => frame.remove(), 1000)
  }
  // Wait for the copied stylesheets before printing
  if (doc.readyState === 'complete') setTimeout(go, 50)
  else frame.addEventListener('load', go, { once: true })
}
