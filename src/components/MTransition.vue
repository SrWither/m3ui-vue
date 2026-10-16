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
const props = withDefaults(defineProps<{
  /** `shared-axis` (horizontal, for forward/back navigation) or `fade-through` (unrelated destinations) */
  type?: 'shared-axis' | 'fade-through'
  /** Shared axis: play the backward transition (the new view comes from the start side) */
  reverse?: boolean
  /** Animate the first view too */
  appear?: boolean
}>(), { type: 'shared-axis', reverse: false, appear: false })

// slideIn/OutHorizontally and scaleIn/Out default to spring(stiffness = StiffnessMediumLow), no bounce
const STIFFNESS = 400
const DAMPING = 2 * Math.sqrt(STIFFNESS)
// HorizontalSharedAxis
const SLIDE_FRACTION = 0.2
const AXIS_FADE = { duration: 90, delay: 50 }
// FadeThrough
const FADE_OUT = 90
const FADE_IN = 210
const INITIAL_SCALE = 0.8
const TARGET_SCALE = 1.05

interface Motion {
  /** Spring from `from` to `to` (an x offset in px, or a scale) */
  from: number
  to: number
  apply: (value: number, el: HTMLElement) => void
  /** Linear opacity tween */
  fade: { from: number; to: number; duration: number; delay: number }
}

const running = new WeakMap<Element, () => void>()

function run(el: HTMLElement, m: Motion, done: () => void) {
  running.get(el)?.()
  let raf = 0
  let value = m.from
  let velocity = 0
  const start = performance.now()
  let last = start
  const threshold = Math.abs(m.to - m.from) > 2 ? 0.5 : 0.001
  const finish = () => {
    cancelAnimationFrame(raf)
    running.delete(el)
    done()
  }
  running.set(el, finish)
  const frame = (now: number) => {
    let dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    while (dt > 0) {
      const h = Math.min(dt, 0.004)
      dt -= h
      velocity += (-STIFFNESS * (value - m.to) - DAMPING * velocity) * h
      value += velocity * h
    }
    const springDone = Math.abs(value - m.to) < threshold && Math.abs(velocity) < threshold * 10
    if (springDone) value = m.to
    m.apply(value, el)
    const t = Math.min(1, Math.max(0, (now - start - m.fade.delay) / m.fade.duration))
    el.style.opacity = String(m.fade.from + (m.fade.to - m.fade.from) * t)
    if (springDone && t >= 1) finish()
    else raf = requestAnimationFrame(frame)
  }
  m.apply(m.from, el)
  el.style.opacity = String(m.fade.from)
  raf = requestAnimationFrame(frame)
}

const translate = (x: number, el: HTMLElement) => { el.style.transform = x ? `translateX(${x}px)` : '' }
const scale = (s: number, el: HTMLElement) => { el.style.transform = s !== 1 ? `scale(${s})` : '' }

function clear(el: HTMLElement) {
  el.style.transform = ''
  el.style.opacity = ''
  el.style.zIndex = ''
}

function onEnter(element: Element, done: () => void) {
  const el = element as HTMLElement
  const finish = () => { clear(el); done() }
  if (props.type === 'fade-through') {
    run(el, { from: INITIAL_SCALE, to: 1, apply: scale, fade: { from: 0, to: 1, duration: FADE_IN, delay: FADE_OUT } }, finish)
    return
  }
  const w = el.offsetWidth
  // Backward: the entering view sits under the leaving one (targetContentZIndex = -10)
  if (props.reverse) el.style.zIndex = '-1'
  run(el, {
    from: (props.reverse ? -1 : 1) * w * SLIDE_FRACTION,
    to: 0,
    apply: translate,
    fade: { from: 0, to: 1, ...AXIS_FADE },
  }, finish)
}

function onLeave(element: Element, done: () => void) {
  const el = element as HTMLElement
  const finish = () => { clear(el); done() }
  if (props.type === 'fade-through') {
    run(el, { from: 1, to: TARGET_SCALE, apply: scale, fade: { from: 1, to: 0, duration: FADE_OUT, delay: 0 } }, finish)
    return
  }
  const w = el.offsetWidth
  run(el, {
    from: 0,
    to: (props.reverse ? 1 : -1) * w * SLIDE_FRACTION,
    apply: translate,
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
