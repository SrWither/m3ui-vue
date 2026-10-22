import type { Directive } from 'vue'

/** Options for `v-click-outside`. */
export interface ClickOutsideOptions {
  /** Called with the event that landed outside the element. */
  handler?: (event: PointerEvent | MouseEvent) => void
  /**
   * Elements that count as inside too: elements or CSS selectors (the button that toggles a panel, or a panel's
   * own popup teleported to `<body>`).
   */
  exclude?: Array<HTMLElement | string | null | undefined>
  /** `'pointerdown'` (default) reacts as the press starts, like menus; `'click'` once it ends, so a drag out doesn't count. */
  event?: 'pointerdown' | 'click'
  /** Off while true. */
  disabled?: boolean
}

/** `v-click-outside` value: the handler, or an options object. */
export type ClickOutsideValue = ((event: PointerEvent | MouseEvent) => void) | ClickOutsideOptions | null | undefined

function normalize(value: ClickOutsideValue): ClickOutsideOptions {
  if (value == null) return {}
  return typeof value === 'function' ? { handler: value } : value
}

interface ClickOutsideState {
  options: ClickOutsideOptions
  listening: 'pointerdown' | 'click' | null
  armTimer: ReturnType<typeof setTimeout> | undefined
  onEvent: (e: Event) => void
}

const states = new WeakMap<HTMLElement, ClickOutsideState>()

function isInside(el: HTMLElement, options: ClickOutsideOptions, e: Event) {
  // composedPath: the target may be gone by now (a click that removed it), and it sees into shadow roots
  const path = e.composedPath()
  if (path.includes(el)) return true
  return (options.exclude ?? []).some((x) => {
    if (!x) return false
    if (typeof x !== 'string') return path.includes(x)
    return path.some((node) => node instanceof Element && node.matches(x))
  })
}

function listen(state: ClickOutsideState) {
  const want = state.options.disabled || !state.options.handler ? null : state.options.event ?? 'pointerdown'
  if (want === state.listening) return
  if (state.listening) document.removeEventListener(state.listening, state.onEvent, true)
  clearTimeout(state.armTimer)
  state.listening = want
  // Armed after the current event: the press or click that showed the element mustn't count as outside it
  if (want) state.armTimer = setTimeout(() => document.addEventListener(want, state.onEvent, true))
}

/**
 * Calls a handler when a press lands outside the element: `v-click-outside="close"` or
 * `v-click-outside="{ handler, exclude, event, disabled }"`. `exclude` takes elements or selectors that count
 * as inside (the toggle button, a teleported popup). Only the primary button counts. Starts listening after the
 * event that mounted it, so the click that opened a panel doesn't close it. Registered globally as
 * `v-click-outside` by `createM3UI()`; import `vClickOutside` to use it without the plugin.
 */
export const vClickOutside: Directive<HTMLElement, ClickOutsideValue> = {
  mounted(el, binding) {
    const state: ClickOutsideState = {
      options: normalize(binding.value),
      listening: null,
      armTimer: undefined,
      onEvent(e) {
        if ((e as MouseEvent).button !== 0 || isInside(el, state.options, e)) return
        state.options.handler?.(e as PointerEvent | MouseEvent)
      },
    }
    states.set(el, state)
    listen(state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = normalize(binding.value)
    listen(state)
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    clearTimeout(state.armTimer)
    if (state.listening) document.removeEventListener(state.listening, state.onEvent, true)
    states.delete(el)
  },
}
