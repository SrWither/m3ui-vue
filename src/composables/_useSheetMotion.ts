import { onBeforeUnmount } from 'vue'
import { motionSprings, type SpringSpec } from './motion'
import { sampleSpring, sampleAt, playSamples, prefersReducedMotion } from './_springAnimation'

/*
 * Internal (not exported from index.ts): enter/exit/drag motion for modal sheets
 * (MBottomSheet on y, MSideSheet on x), after androidx BottomSheet.kt + SheetDefaults.kt:
 * show = Standard DefaultSpatial spring (0.9 / 700) from fully off-screen (offset = the
 * panel's own size), hide = FastEffects (1.0 / 3800), scrim alpha = DefaultEffects
 * (1.0 / 1600). The panel slides only, no opacity fade. A drag release springs from where
 * the finger left it, carrying its velocity, either back open or out.
 *
 * The springs play as Web Animations (see _springAnimation.ts), on the compositor, so the
 * enter isn't janked by the sheet's content mounting at the same moment; only the drag writes
 * the transform directly. The offset is a fraction of the panel's size, so entering never reads
 * layout. The panel's transform must never also be bound reactively in the template, which is
 * what silently killed the old CSS enter animation.
 *
 * Wire it to a `<Transition :css="false" @enter @leave>` around a root holding
 * `[data-sheet-panel]` and `[data-sheet-scrim]`.
 */

const DEFAULT_SPATIAL = motionSprings.standard.defaultSpatial
const FAST_EFFECTS = motionSprings.standard.fastEffects
const DEFAULT_EFFECTS = motionSprings.standard.defaultEffects

/** Past this many px, or this fast (px/s) toward closing, a released drag dismisses. */
const DISMISS_DISTANCE = 100
const DISMISS_VELOCITY = 1000

export function useSheetMotion(axis: 'x' | 'y', onDismiss: () => void) {
  let panel: HTMLElement | null = null
  let scrim: HTMLElement | null = null
  // 0 = open, 1 = off-screen (a fraction of the panel's size); alpha is the scrim's opacity
  let offset = 0
  let alpha = 0
  let alphaTarget = 0
  let velocity = 0
  let offsetAnim: Animation | null = null
  let alphaAnim: Animation | null = null
  let offsetSamples: number[] = []
  let alphaSamples: number[] = []
  let settled: (() => void) | null = null

  let dragging = false
  let dragStart = 0
  let dragOrigin = 0
  let size = 1
  let lastMove = { at: 0, pos: 0 }
  let dragVelocity = 0

  const translate = (f: number) => (axis === 'y' ? `translateY(${f * 100}%)` : `translateX(${f * 100}%)`)

  function write() {
    if (panel) panel.style.transform = translate(offset)
    if (scrim) scrim.style.opacity = String(Math.min(1, Math.max(0, alpha)))
  }

  function stopOffset() {
    if (!offsetAnim) return
    offset = sampleAt(offsetSamples, offsetAnim.currentTime)
    if (panel) panel.style.transform = translate(offset)
    offsetAnim.cancel()
    offsetAnim = null
  }

  function stopAlpha() {
    if (!alphaAnim) return
    alpha = sampleAt(alphaSamples, alphaAnim.currentTime)
    if (scrim) scrim.style.opacity = String(Math.min(1, Math.max(0, alpha)))
    alphaAnim.cancel()
    alphaAnim = null
  }

  function maybeSettle() {
    if (offsetAnim || alphaAnim || dragging) return
    const cb = settled
    settled = null
    cb?.()
  }

  // Without `done`, a pending Transition callback (an enter interrupted by a drag) is kept for this run
  function animate(offsetTo: number, spring: SpringSpec, alphaTo: number, done?: () => void) {
    if (done) {
      settled?.()
      settled = done
    }
    stopOffset()
    const fromOffset = offset
    const v = velocity
    velocity = 0
    // The scrim keeps its running fade when its target doesn't change (a drag released back open)
    const restartAlpha = alphaTo !== alphaTarget || !alphaAnim
    if (restartAlpha) stopAlpha()
    const fromAlpha = alpha
    alphaTarget = alphaTo
    // End states inline underneath, so nothing jumps when the animations end
    offset = offsetTo
    if (restartAlpha) alpha = alphaTo
    write()
    if (prefersReducedMotion()) {
      alphaAnim?.cancel()
      alphaAnim = null
      alpha = alphaTo
      write()
      return maybeSettle()
    }
    if (fromOffset !== offsetTo) {
      offsetSamples = sampleSpring(fromOffset, offsetTo, v, spring, 0.001)
      const a = playSamples(panel, offsetSamples, (f) => ({ transform: translate(f) }))
      offsetAnim = a
      if (a) a.onfinish = () => { if (offsetAnim === a) { offsetAnim = null; maybeSettle() } }
    }
    if (restartAlpha && fromAlpha !== alphaTo) {
      alphaSamples = sampleSpring(fromAlpha, alphaTo, 0, DEFAULT_EFFECTS, 0.002)
      const a = playSamples(scrim, alphaSamples, (o) => ({ opacity: String(Math.min(1, Math.max(0, o))) }))
      alphaAnim = a
      if (a) a.onfinish = () => { if (alphaAnim === a) { alphaAnim = null; maybeSettle() } }
    }
    maybeSettle()
  }

  function bind(el: Element) {
    panel = el.querySelector<HTMLElement>('[data-sheet-panel]')
    scrim = el.querySelector<HTMLElement>('[data-sheet-scrim]')
  }

  function onEnter(el: Element, done: () => void) {
    // Reopened mid-exit: let the old element go now instead of leaving it in the DOM.
    settled?.()
    settled = null
    offsetAnim?.cancel()
    alphaAnim?.cancel()
    offsetAnim = alphaAnim = null
    bind(el)
    offset = 1
    alpha = 0
    alphaTarget = 0
    velocity = 0
    write()
    animate(0, DEFAULT_SPATIAL, 1, done)
  }

  function onLeave(el: Element, done: () => void) {
    bind(el)
    dragging = false
    animate(1, FAST_EFFECTS, 0, done)
  }

  function onDragStart(e: PointerEvent) {
    // A sheet mounted already open never ran onEnter: find its elements from the handle.
    const root = (e.currentTarget as HTMLElement).closest('[data-sheet-panel]')?.parentElement
    if (root) bind(root)
    stopOffset()
    dragging = true
    size = (panel ? (axis === 'y' ? panel.offsetHeight : panel.offsetWidth) : 0) || 1
    dragStart = axis === 'y' ? e.clientY : e.clientX
    dragOrigin = offset * size
    dragVelocity = 0
    lastMove = { at: performance.now(), pos: dragOrigin }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging) return
    const now = performance.now()
    const pos = Math.max(0, dragOrigin + (axis === 'y' ? e.clientY : e.clientX) - dragStart)
    const dt = (now - lastMove.at) / 1000
    if (dt > 0) dragVelocity = (pos - lastMove.pos) / dt
    lastMove = { at: now, pos }
    offset = pos / size
    if (panel) panel.style.transform = translate(offset)
  }

  function onDragEnd() {
    if (!dragging) return
    dragging = false
    // A pause before lifting the finger means no fling.
    if (performance.now() - lastMove.at > 100) dragVelocity = 0
    velocity = dragVelocity / size
    if (offset * size > DISMISS_DISTANCE || dragVelocity > DISMISS_VELOCITY) {
      onDismiss()
    } else {
      animate(0, DEFAULT_SPATIAL, alphaTarget)
    }
  }

  onBeforeUnmount(() => {
    offsetAnim?.cancel()
    alphaAnim?.cancel()
  })

  return { onEnter, onLeave, onDragStart, onDragMove, onDragEnd }
}
