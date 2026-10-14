import { onBeforeUnmount } from 'vue'

/*
 * Internal (not exported from index.ts): enter/exit/drag motion for modal sheets
 * (MBottomSheet on y, MSideSheet on x), after androidx BottomSheet.kt + SheetDefaults.kt:
 * show = Standard DefaultSpatial spring (0.9 / 700) from fully off-screen (offset = the
 * panel's own size), hide = FastEffects (1.0 / 3800), scrim alpha = DefaultEffects
 * (1.0 / 1600). The panel slides only, no opacity fade. A drag release springs from where
 * the finger left it, carrying its velocity, either back open or out.
 *
 * Library convention (see CLAUDE.md): springs stepped in one rAF loop, state in plain
 * variables, the DOM written once per frame. The panel's transform must never also be bound
 * reactively in the template, which is what silently killed the old CSS enter animation.
 *
 * Wire it to a `<Transition :css="false" @enter @leave>` around a root holding
 * `[data-sheet-panel]` and `[data-sheet-scrim]`.
 */

interface Spring { damping: number; stiffness: number }
const DEFAULT_SPATIAL: Spring = { damping: 0.9, stiffness: 700 }
const FAST_EFFECTS: Spring = { damping: 1, stiffness: 3800 }
const DEFAULT_EFFECTS: Spring = { damping: 1, stiffness: 1600 }

/** Past this many px, or this fast (px/s) toward closing, a released drag dismisses. */
const DISMISS_DISTANCE = 100
const DISMISS_VELOCITY = 1000

// Semi-implicit Euler in fixed 4ms substeps: FastEffects' stiffness (3800) is unstable at
// a dropped frame's 33ms step (it diverges instead of settling).
const SUBSTEP = 0.004
function step(s: { pos: number; vel: number }, target: number, spring: Spring, dt: number) {
  for (let left = dt; left > 0; left -= SUBSTEP) {
    const h = Math.min(SUBSTEP, left)
    const accel = -spring.stiffness * (s.pos - target) - 2 * spring.damping * Math.sqrt(spring.stiffness) * s.vel
    s.vel += accel * h
    s.pos += s.vel * h
  }
}

export function useSheetMotion(axis: 'x' | 'y', onDismiss: () => void) {
  let panel: HTMLElement | null = null
  let scrim: HTMLElement | null = null
  const offset = { pos: 0, vel: 0 }
  const alpha = { pos: 0, vel: 0 }
  let offsetTarget = 0
  let alphaTarget = 0
  let offsetSpring = DEFAULT_SPATIAL
  let settled: (() => void) | null = null
  let raf = 0
  let last = 0

  let dragging = false
  let dragStart = 0
  let dragOrigin = 0
  let lastMove = { at: 0, pos: 0 }

  const size = () => (panel ? (axis === 'y' ? panel.offsetHeight : panel.offsetWidth) : 0)
  const reducedMotion = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  function write() {
    if (panel) panel.style.transform = axis === 'y' ? `translateY(${offset.pos}px)` : `translateX(${offset.pos}px)`
    if (scrim) scrim.style.opacity = String(Math.min(1, Math.max(0, alpha.pos)))
  }

  function finish() {
    raf = 0
    const cb = settled
    settled = null
    cb?.()
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    if (!dragging) step(offset, offsetTarget, offsetSpring, dt)
    step(alpha, alphaTarget, DEFAULT_EFFECTS, dt)
    const offsetDone = dragging || (Math.abs(offset.pos - offsetTarget) < 0.5 && Math.abs(offset.vel) < 5)
    const alphaDone = Math.abs(alpha.pos - alphaTarget) < 0.002 && Math.abs(alpha.vel) < 0.05
    if (offsetDone && alphaDone) {
      if (!dragging) offset.pos = offsetTarget
      alpha.pos = alphaTarget
      offset.vel = alpha.vel = 0
      write()
      if (!dragging) return finish()
      raf = 0
      return
    }
    write()
    raf = requestAnimationFrame(frame)
  }

  function run() {
    if (reducedMotion()) {
      offset.pos = offsetTarget
      alpha.pos = alphaTarget
      offset.vel = alpha.vel = 0
      write()
      return finish()
    }
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function bind(el: Element) {
    panel = el.querySelector<HTMLElement>('[data-sheet-panel]')
    scrim = el.querySelector<HTMLElement>('[data-sheet-scrim]')
  }

  function onEnter(el: Element, done: () => void) {
    // Reopened mid-exit: let the old element go now instead of leaving it in the DOM.
    settled?.()
    settled = null
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    bind(el)
    offset.pos = size()
    offset.vel = 0
    alpha.pos = 0
    alpha.vel = 0
    offsetTarget = 0
    alphaTarget = 1
    offsetSpring = DEFAULT_SPATIAL
    settled = done
    write()
    run()
  }

  function onLeave(el: Element, done: () => void) {
    bind(el)
    dragging = false
    offsetTarget = size()
    alphaTarget = 0
    offsetSpring = FAST_EFFECTS
    settled = done
    run()
  }

  function onDragStart(e: PointerEvent) {
    // A sheet mounted already open never ran onEnter: find its elements from the handle.
    const root = (e.currentTarget as HTMLElement).closest('[data-sheet-panel]')?.parentElement
    if (root) bind(root)
    dragging = true
    dragStart = axis === 'y' ? e.clientY : e.clientX
    dragOrigin = offset.pos
    offset.vel = 0
    lastMove = { at: performance.now(), pos: offset.pos }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging) return
    const now = performance.now()
    offset.pos = Math.max(0, dragOrigin + (axis === 'y' ? e.clientY : e.clientX) - dragStart)
    const dt = (now - lastMove.at) / 1000
    if (dt > 0) offset.vel = (offset.pos - lastMove.pos) / dt
    lastMove = { at: now, pos: offset.pos }
    write()
  }

  function onDragEnd() {
    if (!dragging) return
    dragging = false
    // A pause before lifting the finger means no fling.
    if (performance.now() - lastMove.at > 100) offset.vel = 0
    if (offset.pos > DISMISS_DISTANCE || offset.vel > DISMISS_VELOCITY) {
      onDismiss()
    } else {
      offsetTarget = 0
      offsetSpring = DEFAULT_SPATIAL
      run()
    }
  }

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
  })

  return { onEnter, onLeave, onDragStart, onDragMove, onDragEnd }
}
