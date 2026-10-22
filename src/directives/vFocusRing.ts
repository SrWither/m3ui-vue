import type { Directive } from 'vue'

/** Options for `v-focus-ring`. */
export interface FocusRingOptions {
  /** No ring while true. */
  disabled?: boolean
  /** Any CSS color or token for the ring; defaults to `var(--color-secondary)`, as M3's focus indicator. */
  color?: string
  /** Draws the ring inside the element's edge instead of 2px outside it, for elements clipped by a parent. */
  inset?: boolean
  /** Also shows while an element inside it has keyboard focus (a card holding a link or a field). */
  within?: boolean
}

/** `v-focus-ring` value: nothing or `true` (on), `false` (off), a CSS color, or an options object. */
export type FocusRingValue = boolean | string | FocusRingOptions | null | undefined

function normalize(value: FocusRingValue): FocusRingOptions {
  if (value === false) return { disabled: true }
  if (typeof value === 'string') return { color: value }
  if (value === true || value == null) return {}
  return value
}

// The ring itself is in theme.css (`[data-m3-focus-ring]`), drawn as an outline so it follows the element's
// corners and takes no layout; this only keeps the attribute and the color/offset variables in step
function apply(el: HTMLElement, options: FocusRingOptions) {
  el.dataset.m3FocusRing = options.disabled ? 'off' : options.within ? 'within' : ''
  if (options.color) el.style.setProperty('--m3-focus-ring-color', options.color)
  else el.style.removeProperty('--m3-focus-ring-color')
  if (options.inset) el.style.setProperty('--m3-focus-ring-offset', '-3px')
  else el.style.removeProperty('--m3-focus-ring-offset')
}

/**
 * The M3 focus indicator on any element: a 3dp ring in `secondary`, 2dp outside the element, shown on keyboard
 * focus only (`:focus-visible`), never on a click or tap. `<div v-focus-ring tabindex="0">`, `v-focus-ring="false"`,
 * `v-focus-ring="'#e91e63'"` or `v-focus-ring="{ disabled, color, inset, within }"`. It wins over an `outline-none`
 * class on the same element. Registered globally as `v-focus-ring` by `createM3UI()`; import `vFocusRing` to use
 * it without the plugin.
 */
export const vFocusRing: Directive<HTMLElement, FocusRingValue> = {
  mounted(el, binding) {
    apply(el, normalize(binding.value))
  },
  updated(el, binding) {
    apply(el, normalize(binding.value))
  },
  beforeUnmount(el) {
    delete el.dataset.m3FocusRing
    el.style.removeProperty('--m3-focus-ring-color')
    el.style.removeProperty('--m3-focus-ring-offset')
  },
}
