import type { Directive } from 'vue'
import { createReveal, type RevealEffect, type ScrollRevealOptions } from '../composables/useScrollReveal'

/** `v-reveal` value: nothing or `true` (fade up), `false` (off), an effect name, or options. */
export type RevealValue = boolean | RevealEffect | ScrollRevealOptions | null | undefined

function normalize(value: RevealValue): ScrollRevealOptions | null {
  if (value === false) return null
  if (typeof value === 'string') return { effect: value }
  if (value === true || value == null) return {}
  return value
}

// Elements with the same options share one observer, so a list of `v-reveal` items cascades in together
const engines = new Map<string, ReturnType<typeof createReveal>>()
function engineFor(options: ScrollRevealOptions) {
  const key = JSON.stringify(options)
  let engine = engines.get(key)
  if (!engine) engines.set(key, (engine = createReveal(options)))
  return engine
}

const state = new WeakMap<Element, ReturnType<typeof createReveal>>()

function attach(el: Element, value: RevealValue) {
  const options = normalize(value)
  if (!options) return
  const engine = engineFor(options)
  state.set(el, engine)
  engine.observe(el)
}
function detach(el: Element) {
  state.get(el)?.unobserve(el)
  state.delete(el)
}

/**
 * Reveals the element as it scrolls into view, on M3's springs (see `useScrollReveal` for the options):
 * `v-reveal`, `v-reveal="'scale'"`, `v-reveal="{ effect: 'slide-left', delay: 100 }"`. Items of a `v-for` with
 * the same options cascade in. Off with reduced motion. Registered by `createM3UI()`, or import `vReveal`.
 */
export const vReveal: Directive<HTMLElement, RevealValue> = {
  mounted(el, { value }) {
    attach(el, value)
  },
  updated(el, { value, oldValue }) {
    // Only a change of options re-arms it (an inline object literal is a new object on every render)
    if (JSON.stringify(normalize(value)) === JSON.stringify(normalize(oldValue))) return
    detach(el)
    attach(el, value)
  },
  beforeUnmount(el) {
    detach(el)
  },
  // Rendered on the server as is: it hides only once mounted in the browser
  getSSRProps: () => ({}),
}
