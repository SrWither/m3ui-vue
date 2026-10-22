import type { Directive } from 'vue'

/** Options for `v-skeleton`. */
export interface SkeletonOptions {
  /** Shows the placeholder while true. */
  loading?: boolean
  /** MSkeleton's animations (default `'pulse'`). */
  animation?: 'pulse' | 'wave' | 'none'
}

/** `v-skeleton` value: whether it's loading, or an options object. */
export type SkeletonValue = boolean | SkeletonOptions | null | undefined

function normalize(value: SkeletonValue): Required<SkeletonOptions> {
  if (value == null || typeof value === 'boolean') return { loading: !!value, animation: 'pulse' }
  return { loading: !!value.loading, animation: value.animation ?? 'pulse' }
}

interface SkeletonState {
  shimmer: HTMLSpanElement | null
  madeRelative: boolean
}

const states = new WeakMap<HTMLElement, SkeletonState>()

// The look is in theme.css (`[data-m3-skeleton]`): the element keeps its size and corners, its content turns
// invisible (but still lays out), and its background becomes MSkeleton's tint
function apply(el: HTMLElement, state: SkeletonState, value: SkeletonValue) {
  const { loading, animation } = normalize(value)
  if (!loading) return clear(el, state)
  el.dataset.m3Skeleton = animation
  el.setAttribute('aria-busy', 'true')
  if (animation === 'wave') {
    const { position } = getComputedStyle(el)
    if (!state.madeRelative && (!position || position === 'static')) {
      el.style.position = 'relative'
      state.madeRelative = true
    }
    if (!state.shimmer) {
      state.shimmer = document.createElement('span')
      state.shimmer.className = 'm3-skeleton-shimmer'
      state.shimmer.setAttribute('aria-hidden', 'true')
    }
    if (state.shimmer.parentNode !== el) el.appendChild(state.shimmer)
  }
  else state.shimmer?.remove()
}

function clear(el: HTMLElement, state: SkeletonState) {
  delete el.dataset.m3Skeleton
  el.removeAttribute('aria-busy')
  state.shimmer?.remove()
  if (state.madeRelative) {
    el.style.position = ''
    state.madeRelative = false
  }
}

/**
 * Turns an element into its own loading placeholder: `v-skeleton="loading"` or
 * `v-skeleton="{ loading, animation }"`. While loading it keeps its size and corners, hides its content (which
 * still sizes it: placeholder text like `{{ user?.name ?? 'Loading name' }}` gives an empty element a width),
 * takes MSkeleton's tint and animation (`pulse`, `wave` or `none`; still with reduced motion), ignores the pointer
 * and is `aria-busy`. Registered globally as `v-skeleton` by `createM3UI()`; import `vSkeleton` to use it
 * without the plugin.
 */
export const vSkeleton: Directive<HTMLElement, SkeletonValue> = {
  mounted(el, binding) {
    const state: SkeletonState = { shimmer: null, madeRelative: false }
    states.set(el, state)
    apply(el, state, binding.value)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (state) apply(el, state, binding.value)
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (state) clear(el, state)
    states.delete(el)
  },
}
