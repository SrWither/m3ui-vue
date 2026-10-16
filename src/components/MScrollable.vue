<script setup lang="ts">
/**
 * A constrained scroll area — vertical, horizontal, or both directions. Shows the browser's scrollbar, or with
 * `scrollbar="indicator"` M3's thin visual-only scrollbar (Compose's `Modifier.nonInteractiveScrollbar`), which
 * appears while scrolling and fades out after.
 *
 * @slot default The scrolling content.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { fastOutSlowIn } from '../composables/_useSpring'

const props = withDefaults(
  defineProps<{
    /** Scroll direction */
    direction?: 'vertical' | 'horizontal' | 'both'
    /** Fixed height (CSS value) */
    height?: string
    /** Maximum height (CSS value) */
    maxHeight?: string
    /**
     * `native`: the browser's scrollbar. `indicator`: M3's thin scrollbar, visual only (scroll with the wheel,
     * touch or keys). `none`: no scrollbar at all.
     */
    scrollbar?: 'native' | 'indicator' | 'none'
    /** With `scrollbar="indicator"`: show it only while scrolling, fading out after (false keeps it visible) */
    scrollbarFade?: boolean
  }>(),
  { direction: 'vertical', scrollbar: 'native', scrollbarFade: true },
)

const overflowClasses: Record<string, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
}

const classes = computed(() => [
  overflowClasses[props.direction],
  props.scrollbar !== 'native' && 'm3-scrollable-hidden relative',
])

const style = computed(() => ({
  height: props.height,
  maxHeight: props.maxHeight,
}))

// ── Indicator (NonInteractiveScrollbarDefaults) ─────────────────────────────────────────────────
const THICKNESS = 4
const MIN_LENGTH = 24
const MAX_FRACTION = 0.9
const MAIN_INSET = 2
const FADE_DELAY = 400
const FADE_DURATION = 250

const rootEl = ref<HTMLElement>()
const vThumb = ref<HTMLElement>()
const hThumb = ref<HTMLElement>()
const showV = computed(() => props.scrollbar === 'indicator' && props.direction !== 'horizontal')
const showH = computed(() => props.scrollbar === 'indicator' && props.direction !== 'vertical')

let alpha = props.scrollbarFade ? 0 : 1
let fadeTimer = 0
let fadeRaf = 0
let rtl = false

// One axis: thumb length and offset along a track inset by MAIN_INSET at both ends
function thumb(viewport: number, content: number, offset: number) {
  if (content <= viewport || viewport === 0) return null
  const track = viewport - 2 * MAIN_INSET
  if (track <= 0 || track < MIN_LENGTH) return null
  const length = Math.min(Math.max(track * (viewport / content), MIN_LENGTH), track * MAX_FRACTION)
  const max = content - viewport
  return { length, offset: MAIN_INSET + (max > 0 ? (offset / max) * (track - length) : 0) }
}

function draw() {
  const el = rootEl.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight, clientWidth, scrollWidth } = el
  // scrollLeft is negative (or reversed) in RTL; work with the distance from the start
  const scrollLeft = Math.abs(el.scrollLeft)
  if (vThumb.value) {
    const t = thumb(clientHeight, scrollHeight, scrollTop)
    const s = vThumb.value.style
    s.display = t ? '' : 'none'
    if (t) {
      // The thumb lives in the scrolled content, so it's moved back by the scroll offset
      const x = el.scrollLeft
      s.height = `${t.length}px`
      s.transform = `translate(${x}px, ${scrollTop + t.offset}px)`
      s.opacity = String(alpha)
    }
  }
  if (hThumb.value) {
    const t = thumb(clientWidth, scrollWidth, scrollLeft)
    const s = hThumb.value.style
    s.display = t ? '' : 'none'
    if (t) {
      const start = rtl ? clientWidth - t.offset - t.length : t.offset
      s.width = `${t.length}px`
      s.transform = `translate(${el.scrollLeft + start}px, ${scrollTop + clientHeight - THICKNESS}px)`
      s.opacity = String(alpha)
    }
  }
}

// Shown at full opacity while scrolling; FADE_DELAY after the last scroll it fades out over FADE_DURATION
function onScroll() {
  if (props.scrollbar !== 'indicator') return
  if (props.scrollbarFade) {
    cancelAnimationFrame(fadeRaf)
    alpha = 1
    clearTimeout(fadeTimer)
    fadeTimer = window.setTimeout(fadeOut, FADE_DELAY)
  }
  draw()
}

function fadeOut() {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / FADE_DURATION)
    // tween()'s default easing
    alpha = 1 - fastOutSlowIn(t)
    draw()
    if (t < 1) fadeRaf = requestAnimationFrame(step)
  }
  fadeRaf = requestAnimationFrame(step)
}

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  if (!rootEl.value) return
  rtl = getComputedStyle(rootEl.value).direction === 'rtl'
  resizeObserver = new ResizeObserver(draw)
  resizeObserver.observe(rootEl.value)
  if (rootEl.value.firstElementChild) resizeObserver.observe(rootEl.value.firstElementChild)
  draw()
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  clearTimeout(fadeTimer)
  cancelAnimationFrame(fadeRaf)
})
watch(() => [props.scrollbar, props.scrollbarFade, props.direction], () => {
  alpha = props.scrollbarFade ? 0 : 1
  requestAnimationFrame(draw)
})
</script>

<template>
  <div ref="rootEl" :class="classes" :style="style" @scroll.passive="onScroll">
    <slot />
    <span
      v-if="showV"
      ref="vThumb"
      aria-hidden="true"
      class="m3-scrollable-thumb m3-scrollable-thumb-v"
    />
    <span
      v-if="showH"
      ref="hThumb"
      aria-hidden="true"
      class="m3-scrollable-thumb m3-scrollable-thumb-h"
    />
  </div>
</template>

<style>
.m3-scrollable-hidden {
  scrollbar-width: none;
}
.m3-scrollable-hidden::-webkit-scrollbar {
  display: none;
}
.m3-scrollable-thumb {
  position: absolute;
  top: 0;
  border-radius: 9999px;
  /* NonInteractiveScrollbarDefaults.thumbColor: Outline at 70% */
  background: color-mix(in srgb, var(--color-outline) 70%, transparent);
  pointer-events: none;
  opacity: 0;
}
/* Thickness 4dp; the vertical one sits at the end edge, the horizontal one at the bottom */
.m3-scrollable-thumb-v {
  inset-inline-end: 0;
  width: 4px;
}
.m3-scrollable-thumb-h {
  left: 0;
  height: 4px;
}
</style>
