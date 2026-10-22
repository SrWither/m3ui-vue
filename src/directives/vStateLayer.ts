import type { Directive } from 'vue'

/** Options for `v-state-layer`. */
export interface StateLayerOptions {
  /** No state layer while true (e.g. bound to the element's disabled state). `disabled` / `aria-disabled="true"` hosts get none either way. */
  disabled?: boolean
  /** Any CSS color for the layer; defaults to the element's text color (`currentColor`). */
  color?: string
  /** Holds the dragged state (16%) while true, e.g. while the element is being dragged. */
  dragged?: boolean
}

/** `v-state-layer` value: nothing or `true` (on), `false` (off), a CSS color, or an options object. */
export type StateLayerValue = boolean | string | StateLayerOptions | null | undefined

function normalize(value: StateLayerValue): StateLayerOptions {
  if (value === false) return { disabled: true }
  if (typeof value === 'string') return { color: value }
  if (value === true || value == null) return {}
  return value
}

interface StateLayerState {
  layer: HTMLSpanElement
  ensurePositioned: () => void
}

const states = new WeakMap<HTMLElement, StateLayerState>()

// The opacities (hover 8%, focus 10%, pressed 10%, dragged 16%) live in theme.css, keyed on the host's
// `data-m3-state-layer`; this only keeps the layer, its color and that attribute in step with the value.
function apply(el: HTMLElement, layer: HTMLElement, options: StateLayerOptions) {
  el.dataset.m3StateLayer = options.disabled ? 'off' : options.dragged ? 'dragged' : ''
  layer.style.background = options.color ?? ''
}

/**
 * The M3 state layer for any element: a tint in its text color at 8% on hover, 10% on keyboard focus and press,
 * 16% while dragged. `<div v-state-layer>`, `v-state-layer="false"`, `v-state-layer="'#e91e63'"` or
 * `v-state-layer="{ disabled, color, dragged }"`. Pairs with `v-ripple`. A statically positioned element is made
 * `position: relative`. Registered globally as `v-state-layer` by `createM3UI()`; import `vStateLayer` to use it
 * without the plugin.
 */
export const vStateLayer: Directive<HTMLElement, StateLayerValue> = {
  // The marker only (the layer itself is added on the client)
  getSSRProps(binding) {
    const o = normalize(binding.value)
    return { 'data-m3-state-layer': o.disabled ? 'off' : o.dragged ? 'dragged' : '' }
  },
  mounted(el, binding) {
    const layer = document.createElement('span')
    layer.className = 'm3-state-layer'
    layer.setAttribute('aria-hidden', 'true')
    el.appendChild(layer)
    const ensurePositioned = () => {
      const { position } = getComputedStyle(el)
      if (!position || position === 'static') el.style.position = 'relative'
    }
    // On mount, and again on the first hover or focus in case the element wasn't in the document yet
    ensurePositioned()
    el.addEventListener('pointerenter', ensurePositioned, { once: true })
    el.addEventListener('focusin', ensurePositioned, { once: true })
    states.set(el, { layer, ensurePositioned })
    apply(el, layer, normalize(binding.value))
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    // A re-render that replaced the host's children can drop the layer: put it back
    if (state.layer.parentNode !== el) el.appendChild(state.layer)
    apply(el, state.layer, normalize(binding.value))
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (state) {
      el.removeEventListener('pointerenter', state.ensurePositioned)
      el.removeEventListener('focusin', state.ensurePositioned)
      state.layer.remove()
    }
    delete el.dataset.m3StateLayer
    states.delete(el)
  },
}
