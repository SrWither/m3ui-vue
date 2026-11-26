import { onBeforeUnmount, watch, type Ref } from 'vue'

/*
 * Internal (not exported from index.ts): keeps a teleported, `position: fixed` popup attached to the field that
 * opened it while it's open. The page or any scroll container around the field scrolling, the window resizing
 * (browser zoom resizes it too), the visual viewport changing (pinch zoom, the on-screen keyboard) and the field
 * itself resizing (chips wrapping onto a new line) all re-run the component's own `place()`, once per frame. Once
 * the field is scrolled out of sight (outside the window or clipped away by a scroll container around it) the popup
 * closes, rather than floating over unrelated content, and the field loses focus so it doesn't keep looking open.
 * Scrolls inside the popup itself are ignored.
 */

const CLIPS = /(auto|scroll|hidden|clip)/

/** True when nothing of `el` is visible: outside the window, or cut away by an overflow-clipping ancestor. */
export function isAnchorHidden(el: Element): boolean {
  if (!el.isConnected) return true
  const r = el.getBoundingClientRect()
  let top = r.top
  let left = r.left
  let bottom = r.bottom
  let right = r.right
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (s.position === 'fixed') break
    if (!CLIPS.test(s.overflow + s.overflowX + s.overflowY)) continue
    const c = p.getBoundingClientRect()
    top = Math.max(top, c.top)
    left = Math.max(left, c.left)
    bottom = Math.min(bottom, c.bottom)
    right = Math.min(right, c.right)
  }
  top = Math.max(top, 0)
  left = Math.max(left, 0)
  bottom = Math.min(bottom, window.innerHeight)
  right = Math.min(right, window.innerWidth)
  return bottom <= top || right <= left
}

export function useFollowAnchor(options: {
  /** Whether the popup is open: the listeners only exist while it is. */
  open: () => boolean
  /** The field the popup hangs from. */
  anchor: Ref<HTMLElement | null | undefined>
  /** The popup (scrolls inside it don't move it). */
  popup: Ref<HTMLElement | null | undefined>
  /** Re-measures the field and moves the popup. */
  place: () => void
  /** Closes the popup once the field can't be seen. */
  close: () => void
}) {
  let frame = 0
  let observer: ResizeObserver | null = null
  let attached = false

  function run() {
    frame = 0
    if (!options.open()) return
    const anchor = options.anchor.value
    if (!anchor || isAnchorHidden(anchor)) {
      options.close()
      // A focused field looks open (floated label, primary indicator): once it's gone from view, the user left it
      const active = document.activeElement
      if (anchor && active instanceof HTMLElement && anchor.contains(active)) active.blur()
      return
    }
    options.place()
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(run)
  }

  function onScroll(e: Event) {
    const t = e.target
    if (t instanceof Node && options.popup.value?.contains(t)) return
    schedule()
  }

  function attach() {
    if (attached || typeof window === 'undefined') return
    attached = true
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    if (typeof ResizeObserver !== 'undefined' && options.anchor.value) {
      // Its first callback fires right away, with the size the popup was just placed for: harmless
      observer = new ResizeObserver(schedule)
      observer.observe(options.anchor.value)
    }
  }

  function detach() {
    if (!attached) return
    attached = false
    window.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', schedule)
    window.visualViewport?.removeEventListener('resize', schedule)
    window.visualViewport?.removeEventListener('scroll', schedule)
    observer?.disconnect()
    observer = null
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  watch(options.open, (v) => (v ? attach() : detach()), { immediate: true })
  onBeforeUnmount(detach)
}
