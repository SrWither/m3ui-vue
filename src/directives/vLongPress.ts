import type { Directive } from 'vue'

/** Options for `v-long-press`. */
export interface LongPressOptions {
  /** Called once the press has been held for `duration`, with the pointerdown that started it. */
  handler?: (event: PointerEvent) => void
  /** How long to hold, in ms (default 500, as MTooltip's long press). */
  duration?: number
  /** How far (px) the pointer may move before it's a scroll or a drag, not a press (default 10). */
  tolerance?: number
  /** A short vibration when it fires, where the device supports it (default true). */
  haptic?: boolean
  /** Also with a mouse (default true); false leaves the mouse alone, for touch and pen only. */
  mouse?: boolean
  /** Off while true. */
  disabled?: boolean
}

/** `v-long-press` value: the handler, or an options object. */
export type LongPressValue = ((event: PointerEvent) => void) | LongPressOptions | null | undefined

function normalize(value: LongPressValue): LongPressOptions {
  if (value == null) return {}
  return typeof value === 'function' ? { handler: value } : value
}

interface LongPressState {
  options: LongPressOptions
  press: { id: number, x: number, y: number, timer: ReturnType<typeof setTimeout> } | null
  fired: boolean
  onPointerDown: (e: PointerEvent) => void
  onMove: (e: PointerEvent) => void
  onEnd: (e: PointerEvent) => void
  onClick: (e: MouseEvent) => void
  onContextMenu: (e: Event) => void
}

const states = new WeakMap<HTMLElement, LongPressState>()

function endPress(el: HTMLElement, state: LongPressState) {
  if (state.press) clearTimeout(state.press.timer)
  state.press = null
  delete el.dataset.longPressing
  window.removeEventListener('pointermove', state.onMove)
  window.removeEventListener('pointerup', state.onEnd)
  window.removeEventListener('pointercancel', state.onEnd)
}

/**
 * Calls a handler when the element is pressed and held: `v-long-press="onHold"` or
 * `v-long-press="{ handler, duration, tolerance, haptic, mouse, disabled }"`. Moving past the tolerance (a scroll
 * or a drag) cancels it; once it fires, the click the press ends in and the browser's own long-press menu are
 * swallowed, so a long-pressed button doesn't also click. While held, the element has `data-long-pressing`
 * (`data-long-pressing:scale-95`). Registered globally as `v-long-press` by `createM3UI()`; import `vLongPress`
 * to use it without the plugin.
 */
export const vLongPress: Directive<HTMLElement, LongPressValue> = {
  mounted(el, binding) {
    const state: LongPressState = {
      options: normalize(binding.value),
      press: null,
      fired: false,
      onPointerDown(e) {
        const { disabled, handler, mouse = true, duration = 500, haptic = true } = state.options
        if (disabled || !handler || e.button !== 0 || (!mouse && e.pointerType === 'mouse')) return
        endPress(el, state)
        state.fired = false
        el.dataset.longPressing = ''
        state.press = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          timer: setTimeout(() => {
            state.fired = true
            endPress(el, state)
            // The click comes right after the finger lifts, if at all (not over a non-clickable element): stop
            // waiting for it a moment later, or a later keyboard click would be swallowed
            const release = () => {
              window.removeEventListener('pointerup', release)
              window.removeEventListener('pointercancel', release)
              setTimeout(() => { state.fired = false }, 400)
            }
            window.addEventListener('pointerup', release)
            window.addEventListener('pointercancel', release)
            if (haptic) navigator.vibrate?.(10)
            state.options.handler?.(e)
          }, duration),
        }
        window.addEventListener('pointermove', state.onMove)
        window.addEventListener('pointerup', state.onEnd)
        window.addEventListener('pointercancel', state.onEnd)
      },
      onMove(e) {
        const p = state.press
        if (p && e.pointerId === p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > (state.options.tolerance ?? 10)) endPress(el, state)
      },
      onEnd(e) {
        if (state.press && e.pointerId === state.press.id) endPress(el, state)
      },
      // The click a fired press ends in belongs to it
      onClick(e) {
        if (!state.fired) return
        state.fired = false
        e.preventDefault()
        e.stopPropagation()
      },
      onContextMenu(e) {
        if (state.press || state.fired) e.preventDefault()
      },
    }
    states.set(el, state)
    // No iOS callout (copy / share) over the press
    el.style.setProperty('-webkit-touch-callout', 'none')
    el.addEventListener('pointerdown', state.onPointerDown)
    el.addEventListener('click', state.onClick, true)
    el.addEventListener('contextmenu', state.onContextMenu)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = normalize(binding.value)
    if (state.options.disabled) endPress(el, state)
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    endPress(el, state)
    el.removeEventListener('pointerdown', state.onPointerDown)
    el.removeEventListener('click', state.onClick, true)
    el.removeEventListener('contextmenu', state.onContextMenu)
    el.style.removeProperty('-webkit-touch-callout')
    states.delete(el)
  },
}
