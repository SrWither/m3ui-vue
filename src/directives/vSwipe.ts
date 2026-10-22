import type { Directive } from 'vue'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

/** What a swipe handler gets. */
export interface SwipeInfo {
  direction: SwipeDirection
  /** Distance from where the press started, px (x grows rightwards, y downwards). */
  dx: number
  dy: number
  /** Speed along the swipe's axis when the finger lifted, px/ms. */
  velocity: number
  /** The pointerup that ended it. */
  event: PointerEvent
}

/** Options for `v-swipe`. */
export interface SwipeOptions {
  left?: (info: SwipeInfo) => void
  right?: (info: SwipeInfo) => void
  up?: (info: SwipeInfo) => void
  down?: (info: SwipeInfo) => void
  /** Called for a swipe in any direction that has no handler of its own. Listens on both axes. */
  handler?: (info: SwipeInfo) => void
  /** How far (px) the finger has to travel for a slow swipe to count (default 50). */
  threshold?: number
  /** A swipe at least this fast (px/ms) counts whatever its length (default 0.5, a flick). */
  velocity?: number
  /** Called while the finger moves along a listened axis, for feedback (follow the finger, fade a hint). */
  onMove?: (dx: number, dy: number, event: PointerEvent) => void
  /** Called when the press ends, swiped or not (spring a moved element back). */
  onEnd?: (swiped: boolean) => void
  /** Also with a mouse drag (default false: swipes are for touch and pen). */
  mouse?: boolean
  /** Off while true. */
  disabled?: boolean
}

/** `v-swipe` value: a handler for any direction, or an options object. */
export type SwipeValue = ((info: SwipeInfo) => void) | SwipeOptions | null | undefined

function normalize(value: SwipeValue): SwipeOptions {
  if (value == null) return {}
  return typeof value === 'function' ? { handler: value } : value
}

// Before this much movement a press is still a tap
const SLOP = 10

interface SwipeState {
  options: SwipeOptions
  press: { id: number, x: number, y: number, axis: 'x' | 'y' | null, lastX: number, lastY: number, lastT: number, vx: number, vy: number } | null
  moved: boolean
  onPointerDown: (e: PointerEvent) => void
  onMove: (e: PointerEvent) => void
  onUp: (e: PointerEvent) => void
  onCancel: (e: PointerEvent) => void
  onClick: (e: MouseEvent) => void
}

const states = new WeakMap<HTMLElement, SwipeState>()

function axes(o: SwipeOptions) {
  const any = !!o.handler
  return { x: any || !!o.left || !!o.right, y: any || !!o.up || !!o.down }
}

// The browser keeps panning along the axes nobody swipes on, and leaves the others to us (a drag the browser
// pans is cancelled for pointer events). Both axes: nothing pans from this element
function applyTouchAction(el: HTMLElement, o: SwipeOptions) {
  const { x, y } = axes(o)
  el.style.touchAction = o.disabled || (!x && !y) ? '' : x && y ? 'none' : x ? 'pan-y' : 'pan-x'
}

function stopListening(state: SwipeState) {
  window.removeEventListener('pointermove', state.onMove)
  window.removeEventListener('pointerup', state.onUp)
  window.removeEventListener('pointercancel', state.onCancel)
}

// The click comes right after the finger lifts, if at all (touch fires none after a move): stop waiting for it
// a moment later, or a later keyboard click would be swallowed
function expireClickGuard(state: SwipeState) {
  setTimeout(() => { state.moved = false }, 400)
}

/**
 * Calls handlers when an element is swiped: `v-swipe="onSwipe"` (any direction, `info.direction` says which) or
 * `v-swipe="{ left, right, up, down, threshold, velocity, onMove, onEnd, mouse, disabled }"`. A swipe counts past
 * `threshold` px, or at any length when flicked faster than `velocity`. The element's `touch-action` is set from
 * the directions you listen to: only left/right leaves vertical scrolling to the page (`pan-y`), only up/down the
 * horizontal (`pan-x`), both block panning from it (`none`). The click a swipe ends in is swallowed. Registered
 * globally as `v-swipe` by `createM3UI()`; import `vSwipe` to use it without the plugin.
 */
export const vSwipe: Directive<HTMLElement, SwipeValue> = {
  mounted(el, binding) {
    const state: SwipeState = {
      options: normalize(binding.value),
      press: null,
      moved: false,
      onPointerDown(e) {
        const o = state.options
        if (o.disabled || state.press || e.button !== 0 || (!o.mouse && e.pointerType === 'mouse')) return
        const { x, y } = axes(o)
        if (!x && !y) return
        state.moved = false
        state.press = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, vx: 0, vy: 0 }
        window.addEventListener('pointermove', state.onMove)
        window.addEventListener('pointerup', state.onUp)
        window.addEventListener('pointercancel', state.onCancel)
      },
      onMove(e) {
        const p = state.press
        if (!p || e.pointerId !== p.id) return
        const dx = e.clientX - p.x
        const dy = e.clientY - p.y
        if (!p.axis) {
          if (Math.hypot(dx, dy) < SLOP) return
          const { x, y } = axes(state.options)
          const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
          // Along an axis nobody listens to: the page's (or the element's) own scroll
          if ((axis === 'x' && !x) || (axis === 'y' && !y)) {
            state.press = null
            return stopListening(state)
          }
          p.axis = axis
          state.moved = true
        }
        const dt = e.timeStamp - p.lastT
        if (dt > 0) {
          p.vx = 0.8 * ((e.clientX - p.lastX) / dt) + 0.2 * p.vx
          p.vy = 0.8 * ((e.clientY - p.lastY) / dt) + 0.2 * p.vy
        }
        p.lastX = e.clientX
        p.lastY = e.clientY
        p.lastT = e.timeStamp
        state.options.onMove?.(p.axis === 'x' ? dx : 0, p.axis === 'y' ? dy : 0, e)
      },
      onUp(e) {
        const p = state.press
        if (!p || e.pointerId !== p.id) return
        state.press = null
        stopListening(state)
        if (!p.axis) return
        expireClickGuard(state)
        const o = state.options
        const dx = e.clientX - p.x
        const dy = e.clientY - p.y
        // A pause before lifting ends the flick
        const fresh = e.timeStamp - p.lastT < 100
        const along = p.axis === 'x' ? dx : dy
        const speed = fresh ? (p.axis === 'x' ? p.vx : p.vy) : 0
        // Fast enough counts in the direction of the motion, as long as it ends on that side of the start
        const swiped = Math.abs(along) >= (o.threshold ?? 50) || (Math.abs(speed) >= (o.velocity ?? 0.5) && Math.sign(speed) === Math.sign(along))
        const direction: SwipeDirection = p.axis === 'x' ? (along > 0 ? 'right' : 'left') : (along > 0 ? 'down' : 'up')
        const handler = swiped ? (o[direction] ?? o.handler) : undefined
        if (handler) handler({ direction, dx, dy, velocity: Math.abs(speed), event: e })
        o.onEnd?.(!!handler)
      },
      onCancel(e) {
        const p = state.press
        if (!p || e.pointerId !== p.id) return
        state.press = null
        stopListening(state)
        if (!p.axis) return
        expireClickGuard(state)
        state.options.onEnd?.(false)
      },
      // A press that moved was a swipe (or an attempt), not a tap
      onClick(e) {
        if (!state.moved) return
        state.moved = false
        e.preventDefault()
        e.stopPropagation()
      },
    }
    states.set(el, state)
    applyTouchAction(el, state.options)
    el.addEventListener('pointerdown', state.onPointerDown)
    el.addEventListener('click', state.onClick, true)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = normalize(binding.value)
    applyTouchAction(el, state.options)
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    stopListening(state)
    el.removeEventListener('pointerdown', state.onPointerDown)
    el.removeEventListener('click', state.onClick, true)
    el.style.touchAction = ''
    states.delete(el)
  },
}
