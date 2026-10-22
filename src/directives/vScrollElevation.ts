import type { Directive } from 'vue'

/** Options for `v-scroll-elevation`. */
export interface ScrollElevationOptions {
  /**
   * What scrolls: an element, a CSS selector for it, or the window (when left out). A template ref that's still
   * empty (`target: list` before the list mounts) waits for it instead of following the window.
   */
  target?: HTMLElement | Window | string | null
  /** How far (px) the content has to scroll before the element counts as scrolled (default 0: any scroll). */
  threshold?: number
  /**
   * The background while scrolled, any CSS color or token; default `var(--color-surface-container)`, M3's
   * scrolled container color for a top app bar. `false` changes no color: style `[data-scrolled]` yourself.
   */
  color?: string | false
  /** Called when the scrolled state changes. */
  onChange?: (scrolled: boolean) => void
  /** Stops following the scroll while true (and clears the scrolled state). */
  disabled?: boolean
}

/** `v-scroll-elevation` value: nothing or `true` (the window), `false` (off), a selector, or an options object. */
export type ScrollElevationValue = boolean | string | ScrollElevationOptions | null | undefined

function normalize(value: ScrollElevationValue): ScrollElevationOptions {
  if (value === false) return { disabled: true }
  if (typeof value === 'string') return { target: value }
  if (value === true || value == null) return {}
  return value
}

const DEFAULT_COLOR = 'var(--color-surface-container)'

interface ScrollElevationState {
  options: ScrollElevationOptions
  target: HTMLElement | Window | null
  scrolled: boolean
  onScroll: () => void
}

const states = new WeakMap<HTMLElement, ScrollElevationState>()

function resolve(options: ScrollElevationOptions): HTMLElement | Window | null {
  if (!('target' in options)) return typeof window === 'undefined' ? null : window
  const { target } = options
  if (target == null) return null
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target)
  return target
}

function scrollTop(target: HTMLElement | Window) {
  return target instanceof Window ? target.scrollY : target.scrollTop
}

function setScrolled(el: HTMLElement, state: ScrollElevationState, scrolled: boolean) {
  const { color = DEFAULT_COLOR } = state.options
  // Inline, so it wins over the element's own bg-* class while scrolled and gives it back after
  el.style.backgroundColor = scrolled && color !== false ? color : ''
  if (scrolled) el.dataset.scrolled = ''
  else delete el.dataset.scrolled
  if (scrolled !== state.scrolled) {
    state.scrolled = scrolled
    state.options.onChange?.(scrolled)
  }
}

function attach(el: HTMLElement, state: ScrollElevationState) {
  const target = state.options.disabled ? null : resolve(state.options)
  if (target === state.target) return
  state.target?.removeEventListener('scroll', state.onScroll)
  state.target = target
  if (target) {
    target.addEventListener('scroll', state.onScroll, { passive: true })
    state.onScroll()
  }
  else setScrolled(el, state, false)
}

/**
 * Marks an element while the content under it has scrolled, as M3's top app bar does on scroll: it takes the
 * scrolled container color (`surface-container`) and gets a `data-scrolled` attribute for your own styles
 * (`data-scrolled:shadow-elevation-2`). Follows the window, or `v-scroll-elevation="'#list'"` /
 * `{ target, threshold, color, onChange, disabled }`. Add `transition-colors` to the element for a fade.
 * Registered globally as `v-scroll-elevation` by `createM3UI()`; import `vScrollElevation` to use it without the
 * plugin.
 */
export const vScrollElevation: Directive<HTMLElement, ScrollElevationValue> = {
  mounted(el, binding) {
    const state: ScrollElevationState = {
      options: normalize(binding.value),
      target: null,
      scrolled: false,
      onScroll: () => {
        if (state.target) setScrolled(el, state, scrollTop(state.target) > (state.options.threshold ?? 0))
      },
    }
    states.set(el, state)
    attach(el, state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = normalize(binding.value)
    // A target that changed, or a selector / ref that only resolves now
    attach(el, state)
    if (state.target) state.onScroll()
  },
  beforeUnmount(el) {
    const state = states.get(el)
    state?.target?.removeEventListener('scroll', state.onScroll)
    el.style.backgroundColor = ''
    delete el.dataset.scrolled
    states.delete(el)
  },
}
