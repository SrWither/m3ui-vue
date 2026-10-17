<script setup lang="ts">
/**
 * M3's bottom app bar (a port of Compose's `BottomAppBar`): navigation and key actions at the bottom of small
 * screens, with an optional FAB at the end. With `flexible` it's M3 Expressive's `FlexibleBottomAppBar`, a
 * shorter bar whose actions spread across it. With `scrollBehavior="exit-always"` it collapses as the content
 * scrolls down and comes back as it scrolls up.
 *
 * @slot default The actions, usually MIconButtons
 * @slot fab A FAB at the end of the standard bar; an MFab here turns secondary and drops its shadow, as M3's
 *   bottom app bar FAB (`bottomAppBarFabColor`, `bottomAppBarFabElevation`)
 */
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { FAST_SPATIAL } from '../composables/_useSpring'

const props = withDefaults(defineProps<{
  /** M3 Expressive's FlexibleBottomAppBar: 64px instead of 80px, 16px side padding, no FAB slot */
  flexible?: boolean
  /**
   * How the actions are spread: `start` (the standard bar's), `between` (the flexible bar's default),
   * `around`, `evenly`, or `fixed` (centered, 32px apart: FlexibleFixedHorizontalArrangement)
   */
  arrangement?: 'start' | 'between' | 'around' | 'evenly' | 'fixed'
  /** Container color: surface-container, or a color's container for a vibrant bar */
  color?: 'surface' | 'primary' | 'secondary' | 'tertiary'
  /** `pinned` stays put; `exit-always` collapses while the content scrolls down and returns when it scrolls up */
  scrollBehavior?: 'pinned' | 'exit-always'
  /** What `exit-always` follows: an element or a CSS selector for it. Defaults to the window */
  scrollTarget?: HTMLElement | string | null
}>(), {
  flexible: false,
  color: 'surface',
  scrollBehavior: 'pinned',
  scrollTarget: null,
})

// An MFab in #fab reads this (secondary, no elevation)
provide('m-bottom-app-bar', true)

const colorClass = computed(() => ({
  surface: 'bg-surface-container text-on-surface',
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
}[props.color]))

const arrangementClass = computed(() => ({
  start: 'justify-start',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
  fixed: 'justify-center gap-8',
}[props.arrangement ?? (props.flexible ? 'between' : 'start')]))

// ── exit-always ──────────────────────────────────────────────────────────────────────────────────
// BottomAppBarState: heightOffset runs from 0 (expanded) to -height (collapsed) and is applied to the
// bar's height, so the bar shrinks from its top edge and gives its space back to the layout. Compose
// feeds it the nested scroll's consumed delta; here it's the scroll target's own scroll delta, so the
// browser's momentum scrolling stands in for Compose's fling decay.
const outerEl = ref<HTMLElement>()
const innerEl = ref<HTMLElement>()
let offset = 0
let velocity = 0
let snapTarget: number | null = null
let raf = 0
let last = 0
let settleTimer = 0
let lastScroll = 0
let target: HTMLElement | Window | null = null

const limit = () => -(innerEl.value?.offsetHeight ?? 0)

function write() {
  if (!outerEl.value) return
  outerEl.value.style.height = offset === 0 ? '' : `${Math.max(0, (innerEl.value?.offsetHeight ?? 0) + offset)}px`
}

const scrollTop = () => (target instanceof Window ? target.scrollY : target?.scrollTop ?? 0)

function stopSnap() {
  cancelAnimationFrame(raf)
  raf = 0
  snapTarget = null
  velocity = 0
}

function onScroll() {
  const y = scrollTop()
  const dy = y - lastScroll
  lastScroll = y
  if (!dy) return
  stopSnap()
  offset = Math.min(0, Math.max(limit(), offset - dy))
  write()
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(settle, 150)
}

// settleAppBarBottom: a bar left half-way snaps to whichever end is closer, on the FastSpatial spring
function settle() {
  const lim = limit()
  if (!lim || offset === 0 || offset === lim) return
  snapTarget = offset / lim < 0.5 ? 0 : lim
  last = performance.now()
  raf = requestAnimationFrame(frame)
}

function frame(now: number) {
  if (snapTarget === null) return
  let dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const k = FAST_SPATIAL.stiffness
  const c = 2 * FAST_SPATIAL.dampingRatio * Math.sqrt(k)
  while (dt > 0) {
    const h = Math.min(dt, 0.004)
    dt -= h
    velocity += (-k * (offset - snapTarget) - c * velocity) * h
    offset += velocity * h
  }
  if (Math.abs(offset - snapTarget) < 0.5 && Math.abs(velocity) < 0.5) {
    offset = snapTarget
    write()
    stopSnap()
    return
  }
  write()
  raf = requestAnimationFrame(frame)
}

function resolveTarget(): HTMLElement | Window | null {
  if (typeof window === 'undefined') return null
  if (!props.scrollTarget) return window
  if (typeof props.scrollTarget === 'string') return document.querySelector<HTMLElement>(props.scrollTarget)
  return props.scrollTarget
}

function attach() {
  detach()
  if (props.scrollBehavior !== 'exit-always') return
  target = resolveTarget()
  if (!target) return
  lastScroll = scrollTop()
  target.addEventListener('scroll', onScroll, { passive: true })
}

function detach() {
  target?.removeEventListener('scroll', onScroll)
  target = null
  clearTimeout(settleTimer)
  stopSnap()
  offset = 0
  write()
}

onMounted(attach)
onUnmounted(detach)
watch(() => [props.scrollBehavior, props.scrollTarget], attach)
</script>

<template>
  <div ref="outerEl" class="w-full shrink-0 overflow-hidden" :class="colorClass">
    <!-- Bottom safe area (windowInsets) below the bar's own height, which stays fixed while it collapses -->
    <div ref="innerEl" style="padding-bottom: env(safe-area-inset-bottom)">
      <!-- Standard: ContentPadding 4dp start/top/end (16dp minus the icon buttons' touch target).
           Flexible: DockedToolbarTokens, 64dp tall, 16dp leading/trailing space. -->
      <div class="flex items-center" :class="flexible ? ['h-16 px-4', arrangementClass] : 'h-20 px-1 pt-1'">
        <template v-if="flexible">
          <slot />
        </template>
        <template v-else>
          <div class="flex min-w-0 flex-1 items-center" :class="arrangementClass">
            <slot />
          </div>
          <!-- FAB 12dp from the top and 16dp from the end edge -->
          <div v-if="$slots.fab" class="flex h-full shrink-0 items-start pt-2 pr-3">
            <slot name="fab" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
