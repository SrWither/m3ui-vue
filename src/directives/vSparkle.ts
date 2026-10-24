import type { Directive } from 'vue'
import { getShape, toSvgPath, type ShapeName } from 'shape-morph'

/** Options for `v-sparkle`. */
export interface SparkleOptions {
  /** No sparkles while true */
  disabled?: boolean
  /** `'always'` (default) sparkles all the time; `'hover'` only while the pointer is over it or focus is in it */
  trigger?: 'always' | 'hover'
  /** Any CSS colors, one picked per sparkle. Default: the theme's primary and tertiary where the element is */
  color?: string | string[]
  /** Sparkle size in px, each one a bit bigger or smaller (default 14) */
  size?: number
  /** Sparkles per second (default 3) */
  rate?: number
  /** MShape's shapes instead of the four-pointed star */
  shapes?: ShapeName[]
}

/** `v-sparkle` value: nothing or `true` (on), `false` (off), `'hover'`, a CSS color, or an options object. */
export type SparkleValue = boolean | string | SparkleOptions | null | undefined

function normalize(value: SparkleValue): SparkleOptions {
  if (value === false) return { disabled: true }
  if (value === 'hover' || value === 'always') return { trigger: value }
  if (typeof value === 'string') return { color: value }
  if (value === true || value == null) return {}
  return value
}

// The classic four-pointed sparkle, in a 100×100 box like MShape's paths
const STAR = 'M50 0C54 34 66 46 100 50C66 54 54 66 50 100C46 66 34 54 0 50C34 46 46 34 50 0Z'
const SVG_NS = 'http://www.w3.org/2000/svg'
const paths = new Map<string, string>()
function pathFor(shape: ShapeName) {
  let d = paths.get(shape)
  if (!d) paths.set(shape, (d = toSvgPath(getShape(shape), 100)))
  return d
}

interface SparkleState {
  options: SparkleOptions
  layer: HTMLElement | null
  timer: ReturnType<typeof setTimeout> | undefined
  hovering: boolean
  visible: boolean
  observer: IntersectionObserver | null
  on: Record<string, () => void>
}

const states = new WeakMap<HTMLElement, SparkleState>()

function spawn(el: HTMLElement, state: SparkleState) {
  if (!state.layer) {
    const { position } = getComputedStyle(el)
    if (!position || position === 'static') el.style.position = 'relative'
    const layer = document.createElement('span')
    layer.className = 'm3-sparkle-layer'
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:1'
    el.appendChild(layer)
    state.layer = layer
  }
  const { options } = state
  const colors = options.color ? [options.color].flat() : ['var(--color-primary)', 'var(--color-tertiary)']
  const size = (options.size ?? 14) * (0.6 + Math.random() * 0.8)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('width', `${size}`)
  svg.setAttribute('height', `${size}`)
  // Anywhere over the element, a little past its edges
  svg.style.cssText = `position:absolute;left:${-10 + Math.random() * 120}%;top:${-15 + Math.random() * 130}%;margin:${-size / 2}px 0 0 ${-size / 2}px;overflow:visible`
  const path = document.createElementNS(SVG_NS, 'path')
  const shapes = options.shapes
  path.setAttribute('d', shapes?.length ? pathFor(shapes[Math.floor(Math.random() * shapes.length)]!) : STAR)
  path.style.fill = colors[Math.floor(Math.random() * colors.length)]!
  svg.appendChild(path)
  state.layer.appendChild(svg)
  const turn = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 60)
  const anim = svg.animate(
    [
      { transform: 'scale(0) rotate(0deg)' },
      { transform: `scale(1) rotate(${turn / 2}deg)`, offset: 0.45 },
      { transform: `scale(0) rotate(${turn}deg)` },
    ],
    { duration: 700 + Math.random() * 300, easing: 'ease-in-out', fill: 'both' },
  )
  const remove = () => svg.remove()
  anim.addEventListener('finish', remove, { once: true })
  anim.addEventListener('cancel', remove, { once: true })
}

function active(state: SparkleState) {
  const { options } = state
  if (options.disabled || !state.visible) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return options.trigger === 'hover' ? state.hovering : true
}

// One sparkle at a time at random intervals around 1/rate, while active
function schedule(el: HTMLElement, state: SparkleState, now = false) {
  clearTimeout(state.timer)
  state.timer = undefined
  if (!active(state)) return
  if (now) spawn(el, state)
  const every = 1000 / Math.max(0.1, state.options.rate ?? 3)
  state.timer = setTimeout(() => {
    // A hidden tab keeps the timer (throttled) but draws nothing
    if (active(state) && !document.hidden) spawn(el, state)
    schedule(el, state)
  }, every * (0.5 + Math.random()))
}

function stop(state: SparkleState) {
  clearTimeout(state.timer)
  state.timer = undefined
}

/**
 * Sparkles that twinkle over an element, to draw the eye to something new or special: `v-sparkle`,
 * `v-sparkle="'hover'"`, `v-sparkle="'#f5b400'"` or `v-sparkle="{ trigger, color, size, rate, shapes, disabled }"`.
 * They're drawn in a layer over the element (a statically positioned one is made `position: relative`), hidden from
 * assistive technology, and pause while it's off screen or the tab is hidden; none under reduced motion.
 * Registered globally as `v-sparkle` by `createM3UI()`; import `vSparkle` to use it without the plugin.
 */
export const vSparkle: Directive<HTMLElement, SparkleValue> = {
  mounted(el, binding) {
    const state: SparkleState = {
      options: normalize(binding.value),
      layer: null,
      timer: undefined,
      hovering: false,
      visible: true,
      observer: null,
      on: {},
    }
    const hover = (value: boolean) => () => {
      state.hovering = value
      if (value) schedule(el, state, true)
      else if (!active(state)) stop(state)
    }
    state.on = {
      pointerenter: hover(true),
      pointerleave: hover(false),
      focusin: hover(true),
      focusout: hover(false),
    }
    for (const [type, fn] of Object.entries(state.on)) el.addEventListener(type, fn)
    if (typeof IntersectionObserver !== 'undefined') {
      state.observer = new IntersectionObserver(([entry]) => {
        state.visible = !!entry?.isIntersecting
        if (state.visible) schedule(el, state)
        else stop(state)
      })
      state.observer.observe(el)
    }
    states.set(el, state)
    schedule(el, state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    const next = normalize(binding.value)
    // An inline object literal is a new object on every render: only a real change reschedules
    if (JSON.stringify(next) === JSON.stringify(state.options)) return
    state.options = next
    schedule(el, state)
  },
  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    stop(state)
    state.observer?.disconnect()
    for (const [type, fn] of Object.entries(state.on)) el.removeEventListener(type, fn)
    state.layer?.remove()
    states.delete(el)
  },
  // Nothing on the server: the sparkles start once mounted in the browser
  getSSRProps: () => ({}),
}
