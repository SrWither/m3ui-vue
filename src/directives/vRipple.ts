import type { Directive } from 'vue'

/** Options for `v-ripple`. */
export interface RippleOptions {
  /** No ripple while true (e.g. bound to the element's disabled state). */
  disabled?: boolean
  /** Any CSS color for the ripple; defaults to the element's text color (`currentColor`). */
  color?: string
}

/** `v-ripple` value: nothing or `true` (on), `false` (off), a CSS color, or an options object. */
export type RippleValue = boolean | string | RippleOptions | null | undefined

function normalize(value: RippleValue): RippleOptions {
  if (value === false) return { disabled: true }
  if (typeof value === 'string') return { color: value }
  if (value === true || value == null) return {}
  return value
}

// The ripple sits in its own clipping layer (`border-radius: inherit`), so the host only needs to be
// positioned, not `overflow: hidden`.
function spawnRipple(host: HTMLElement, event: { clientX: number; clientY: number }, color?: string) {
  const rect = host.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const layer = document.createElement('span')
  layer.className = 'm3-ripple-layer'
  const el = document.createElement('span')
  el.className = 'm3-ripple'
  el.style.cssText = `width:${d}px;height:${d}px;top:${event.clientY - rect.top - d / 2}px;left:${event.clientX - rect.left - d / 2}px`
  if (color) el.style.background = color
  layer.appendChild(el)
  host.appendChild(layer)
  el.addEventListener('animationend', () => layer.remove(), { once: true })
}

interface RippleState {
  options: RippleOptions
  onPointerDown: (e: PointerEvent) => void
}

const states = new WeakMap<HTMLElement, RippleState>()

/**
 * The M3 press ripple for any element: `<div v-ripple>`, `v-ripple="false"`, `v-ripple="'#e91e63'"`
 * or `v-ripple="{ disabled, color }"`. A statically positioned element is made `position: relative`.
 * Registered globally as `v-ripple` by `createM3UI()`; import `vRipple` to use it without the plugin.
 */
export const vRipple: Directive<HTMLElement, RippleValue> = {
  mounted(el, binding) {
    const state: RippleState = {
      options: normalize(binding.value),
      onPointerDown(e) {
        if (state.options.disabled || e.button !== 0) return
        // Checked on press, not on mount: the element may not be in the document yet when mounted.
        const { position } = getComputedStyle(el)
        if (!position || position === 'static') el.style.position = 'relative'
        spawnRipple(el, e, state.options.color)
      },
    }
    states.set(el, state)
    el.addEventListener('pointerdown', state.onPointerDown)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (state) state.options = normalize(binding.value)
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (state) el.removeEventListener('pointerdown', state.onPointerDown)
    states.delete(el)
  },
}
