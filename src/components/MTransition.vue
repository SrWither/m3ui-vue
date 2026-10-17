<script setup lang="ts">
/**
 * M3's navigation transitions between two views (a port of Compose's `MaterialTransitions`): `shared-axis`
 * slides the new view in from the side as the old one slides out (use `reverse` when going back), and
 * `fade-through` fades the old view out and the new one in with a slight scale, for destinations without a
 * spatial relationship such as navigation bar tabs. Wrap content that changes its `key` (or a `v-if`/`v-else`
 * pair, or a `<RouterView>` slot's component); both views overlap while they animate.
 *
 * @slot default The current view; give it a `key` that changes with it
 */
import { sampleSpring, playSamples } from '../composables/_springAnimation'

const props = withDefaults(defineProps<{
  /** `shared-axis` (horizontal, for forward/back navigation) or `fade-through` (unrelated destinations) */
  type?: 'shared-axis' | 'fade-through'
  /** Shared axis: play the backward transition (the new view comes from the start side) */
  reverse?: boolean
  /** Animate the first view too */
  appear?: boolean
}>(), { type: 'shared-axis', reverse: false, appear: false })

// slideIn/OutHorizontally and scaleIn/Out default to spring(stiffness = StiffnessMediumLow), no bounce
const SPRING = { dampingRatio: 1, stiffness: 400 }
// HorizontalSharedAxis
const SLIDE_FRACTION = 0.2
const AXIS_FADE = { duration: 90, delay: 50 }
// FadeThrough
const FADE_OUT = 90
const FADE_IN = 210
const INITIAL_SCALE = 0.8
const TARGET_SCALE = 1.05

interface Motion {
  /** Spring from `from` to `to` (an x offset as a fraction of the view's width, or a scale) */
  from: number
  to: number
  transform: (value: number) => string
  /** Linear opacity tween */
  fade: { from: number; to: number; duration: number; delay: number }
}

const running = new WeakMap<Element, () => void>()

// Played as Web Animations (see _springAnimation.ts), which the compositor runs, so the entering view mounting
// (the busiest moment of a navigation) doesn't jank the transition
function run(el: HTMLElement, m: Motion, done: () => void) {
  running.get(el)?.()
  const samples = sampleSpring(m.from, m.to, 0, SPRING, 0.001)
  const move = playSamples(el, samples, (v) => ({ transform: m.transform(v) }))
  const fade = typeof el.animate === 'function'
    ? el.animate([{ opacity: String(m.fade.from) }, { opacity: String(m.fade.to) }], {
        duration: m.fade.duration,
        delay: m.fade.delay,
        easing: 'linear',
        // Holds the starting opacity through the delay
        fill: 'backwards',
      })
    : null
  fade?.finished.catch(() => {})
  // The end state goes inline underneath
  el.style.transform = m.transform(m.to)
  el.style.opacity = String(m.fade.to)
  let ended = false
  const finish = () => {
    if (ended) return
    ended = true
    move?.cancel()
    fade?.cancel()
    running.delete(el)
    done()
  }
  running.set(el, finish)
  Promise.all([move?.finished, fade?.finished]).then(finish, () => {})
}

const translate = (x: number) => `translateX(${x * 100}%)`
const scale = (v: number) => `scale(${v})`

function clear(el: HTMLElement) {
  el.style.transform = ''
  el.style.opacity = ''
  el.style.zIndex = ''
}

function onEnter(element: Element, done: () => void) {
  const el = element as HTMLElement
  const finish = () => { clear(el); done() }
  if (props.type === 'fade-through') {
    run(el, { from: INITIAL_SCALE, to: 1, transform: scale, fade: { from: 0, to: 1, duration: FADE_IN, delay: FADE_OUT } }, finish)
    return
  }
  // Backward: the entering view sits under the leaving one (targetContentZIndex = -10)
  if (props.reverse) el.style.zIndex = '-1'
  run(el, {
    from: (props.reverse ? -1 : 1) * SLIDE_FRACTION,
    to: 0,
    transform: translate,
    fade: { from: 0, to: 1, ...AXIS_FADE },
  }, finish)
}

function onLeave(element: Element, done: () => void) {
  const el = element as HTMLElement
  const finish = () => { clear(el); done() }
  if (props.type === 'fade-through') {
    run(el, { from: 1, to: TARGET_SCALE, transform: scale, fade: { from: 1, to: 0, duration: FADE_OUT, delay: 0 } }, finish)
    return
  }
  run(el, {
    from: 0,
    to: (props.reverse ? 1 : -1) * SLIDE_FRACTION,
    transform: translate,
    fade: { from: 1, to: 0, ...AXIS_FADE },
  }, finish)
}

function onCancel(el: Element) {
  running.get(el)?.()
}
</script>

<template>
  <!-- Clipped, as AnimatedContent clips by default (SizeTransform(clip = true)) -->
  <div class="m3-transition isolate grid overflow-hidden">
    <Transition
      :css="false"
      :appear="appear"
      @enter="onEnter"
      @leave="onLeave"
      @enter-cancelled="onCancel"
      @leave-cancelled="onCancel"
    >
      <slot />
    </Transition>
  </div>
</template>

<style>
/* Both views share one grid cell while they animate */
.m3-transition > * {
  grid-area: 1 / 1;
  min-width: 0;
}
</style>
