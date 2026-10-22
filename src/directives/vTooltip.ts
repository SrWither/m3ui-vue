import type { Directive } from 'vue'
import { createTooltipTrigger, placeTooltip, type TooltipPlacement } from '../composables/_tooltipTrigger'

/** Options for `v-tooltip`. */
export interface TooltipOptions {
  /** The tooltip's text; nothing shows while it's empty. */
  text?: string
  /** Side of the element it shows on (default `'top'`); it stays inside the window. */
  placement?: TooltipPlacement
  /** Delay before it shows on hover or keyboard focus, in ms (default 600, like MTooltip). */
  delay?: number
  /** Never shows while true. */
  disabled?: boolean
}

/** `v-tooltip` value: the text, or an options object. */
export type TooltipValue = string | TooltipOptions | null | undefined

function normalize(value: TooltipValue): TooltipOptions {
  if (value == null) return {}
  return typeof value === 'string' ? { text: value } : value
}

// MTooltip's plain tooltip
const TIP_CLASS = 'pointer-events-none fixed z-400 min-h-6 min-w-10 max-w-[200px] rounded bg-inverse-surface px-2 py-1 text-body-small text-inverse-on-surface'

let nextId = 0

interface TooltipState {
  options: TooltipOptions
  tip: HTMLDivElement | null
  // Tooltips still fading out, removed at once if the element goes away first
  leaving: Set<HTMLDivElement>
  id: string
  trigger: ReturnType<typeof createTooltipTrigger>
}

const states = new WeakMap<HTMLElement, TooltipState>()

function open(el: HTMLElement, state: TooltipState) {
  const { text, disabled, placement = 'top' } = state.options
  if (!text || disabled) return
  let tip = state.tip
  if (!tip) {
    tip = document.createElement('div')
    tip.className = TIP_CLASS
    tip.id = state.id
    tip.setAttribute('role', 'tooltip')
    document.body.appendChild(tip)
    state.tip = tip
    tip.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
  }
  tip.textContent = text
  const { top, left } = placeTooltip(el, tip, placement)
  tip.style.top = `${top}px`
  tip.style.left = `${left}px`
  addDescribedBy(el, state.id)
}

function close(el: HTMLElement, state: TooltipState) {
  const tip = state.tip
  if (!tip) return
  state.tip = null
  removeDescribedBy(el, state.id)
  const anim = tip.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' })
  if (!anim) return tip.remove()
  state.leaving.add(tip)
  anim.onfinish = () => {
    state.leaving.delete(tip)
    tip.remove()
  }
}

// While it shows, the element is described by it (aria-describedby), keeping any ids already there
function addDescribedBy(el: HTMLElement, id: string) {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
  if (!ids.includes(id)) el.setAttribute('aria-describedby', [...ids, id].join(' '))
}
function removeDescribedBy(el: HTMLElement, id: string) {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id)
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '))
  else el.removeAttribute('aria-describedby')
}

/**
 * MTooltip's plain tooltip on any element, without wrapping it: `v-tooltip="'Save'"` or
 * `v-tooltip="{ text, placement, delay, disabled }"`. Shows after a delay on mouse hover, on keyboard focus, and
 * on a long press on touch (swallowing that press's click, hiding 1.5s after the finger lifts); Escape and
 * scrolling hide it. Registered globally as `v-tooltip` by `createM3UI()`; import `vTooltip` to use it without
 * the plugin.
 */
export const vTooltip: Directive<HTMLElement, TooltipValue> = {
  mounted(el, binding) {
    const state = {
      options: normalize(binding.value),
      tip: null,
      leaving: new Set(),
      id: `m3-tooltip-${++nextId}`,
    } as unknown as TooltipState
    state.trigger = createTooltipTrigger(el, {
      delay: () => state.options.delay ?? 600,
      visible: () => !!state.tip,
      open: () => open(el, state),
      close: () => close(el, state),
      tip: () => state.tip,
    })
    states.set(el, state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = normalize(binding.value)
    // Showing: follow the new text, or hide when it went empty or disabled
    if (state.tip) {
      if (!state.options.text || state.options.disabled) state.trigger.closeNow()
      else open(el, state)
    }
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    state.trigger.destroy()
    state.tip?.remove()
    state.leaving.forEach((tip) => tip.remove())
    removeDescribedBy(el, state.id)
    states.delete(el)
  },
}
