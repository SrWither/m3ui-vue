<script setup lang="ts">
/**
 * A container for grouping icon buttons and actions — docked to an edge or floating as a rounded pill,
 * horizontal or vertical, with an optional paired FAB. A floating toolbar collapses (`v-model:expanded`): with a
 * FAB, into the FAB, which grows to 80px; without one, to its center (the default slot), closing `#leading` and
 * `#trailing`. `collapseOnScroll` does it as the content scrolls.
 *
 * @slot fab A FAB rendered alongside the toolbar body, positioned by fabPosition. The toolbar sizes an MFab in it
 * @slot default Toolbar items — typically MIconButton/MButton, separated with MDivider. With #leading or #trailing,
 *   the center, which stays when a floating toolbar without a FAB collapses
 * @slot leading Items before the center, hidden when a floating toolbar without a FAB collapses
 * @slot trailing Items after the center, hidden when a floating toolbar without a FAB collapses
 * @event update:expanded The toolbar collapsed or expanded on scroll (`collapseOnScroll`)
 */
import { computed, onMounted, onUnmounted, onUpdated, ref, useSlots, watch } from 'vue'
import { motionSprings } from '../composables/motion'
import MToolbarFab from './_MToolbarFab.vue'

const props = withDefaults(defineProps<{
  /** Docked (edge-attached, full width/height, bordered) or floating (rounded pill with shadow) */
  variant?: 'docked' | 'floating'
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical'
  /** Background color scheme */
  color?: 'surface' | 'primary' | 'secondary' | 'tertiary'
  /** Where the #fab slot renders relative to the toolbar body */
  fabPosition?: 'start' | 'end' | 'none'
  /** Item alignment along the main axis */
  align?: 'start' | 'center' | 'end' | 'between'
  /**
   * Collapse a floating toolbar as the content scrolls down and expand it as it scrolls back up (40px each way):
   * `true` follows the window, or pass the scrolling element (or a CSS selector for it). Off by default
   */
  collapseOnScroll?: boolean | string | HTMLElement | null
}>(), {
  variant: 'docked',
  orientation: 'horizontal',
  color: 'surface',
  fabPosition: 'none',
  align: 'center',
  collapseOnScroll: false,
})

/** A floating toolbar's state: collapsed, it shows only the FAB, or only its center without one. Default `true` */
const expanded = defineModel<boolean>('expanded', { default: true })

const slots = useSlots()

const colorClasses = computed(() => {
  const map: Record<string, string> = {
    surface: 'bg-surface-container text-on-surface',
    primary: 'bg-primary-container text-on-primary-container',
    secondary: 'bg-secondary-container text-on-secondary-container',
    tertiary: 'bg-tertiary-container text-on-tertiary-container',
  }
  return map[props.color] ?? map.surface
})

const alignClass = computed(() => {
  const map: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  }
  return map[props.align] ?? 'justify-center'
})

const isVertical = computed(() => props.orientation === 'vertical')
const floating = computed(() => props.variant === 'floating')
const hasFab = computed(() => !!slots.fab && props.fabPosition !== 'none')
// A floating toolbar with a FAB collapses into it; one without, to its center
const fabMode = computed(() => floating.value && hasFab.value)
const sections = computed(() => !!(slots.leading || slots.trailing))
const collapsible = computed(() => floating.value && (hasFab.value || sections.value))
// The standard floating toolbar's FAB is PrimaryContainer, the vibrant one's TertiaryContainer
const fabColor = computed(() => (props.color === 'surface' ? 'primary' : 'tertiary'))
// What a collapsed toolbar hides is out of reach for keyboard and assistive technology
const hidden = computed(() => collapsible.value && !expanded.value)

// ── Collapse: one spring (FloatingToolbarDefaults.animationSpec = Expressive FastSpatial) for the progress, in a
// rAF loop that writes sizes (layout, so not a Web Animation). Like Compose: with a FAB, the toolbar keeps its
// footprint and clips toward the FAB, which grows from 56 to 80dp; without, #leading/#trailing shrink toward the
// center. Settled expanded, every size is left to the layout (style cleared), so content changes reflow normally.
const FAB_MIN = 56
const FAB_MAX = 80
const region = ref<HTMLElement>()
const body = ref<HTMLElement>()
const inner = ref<HTMLElement>()
const fabBox = ref<HTMLElement>()
const leadClip = ref<HTMLElement>()
const leadInner = ref<HTMLElement>()
const trailClip = ref<HTMLElement>()
const trailInner = ref<HTMLElement>()

let progress = expanded.value ? 1 : 0
let velocity = 0
let raf = 0
let last = 0
let full = 0
let lead = 0
let trail = 0
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const size = () => (isVertical.value ? 'height' : 'width')
const measure = (el?: HTMLElement) => (el ? (isVertical.value ? el.offsetHeight : el.offsetWidth) : 0)

function write() {
  const settled = !raf
  const p = Math.max(0, progress)
  const axis = size()
  const open = settled && progress === 1
  if (fabMode.value) {
    if (region.value) region.value.style[axis] = open ? '' : `${full}px`
    if (body.value) body.value.style[axis] = open ? '' : `${full * p}px`
    const fab = Math.max(0, FAB_MIN + (FAB_MAX - FAB_MIN) * (1 - progress))
    if (fabBox.value) {
      fabBox.value.style.width = `${fab}px`
      fabBox.value.style.height = `${fab}px`
    }
  } else if (floating.value) {
    if (leadClip.value) leadClip.value.style[axis] = open ? '' : `${lead * p}px`
    if (trailClip.value) trailClip.value.style[axis] = open ? '' : `${trail * p}px`
  }
}

function frame(now: number) {
  let dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const { stiffness: k, dampingRatio } = motionSprings.expressive.fastSpatial
  const c = 2 * dampingRatio * Math.sqrt(k)
  const target = expanded.value ? 1 : 0
  while (dt > 0) {
    const h = Math.min(dt, 0.004)
    dt -= h
    velocity += (-k * (progress - target) - c * velocity) * h
    progress += velocity * h
  }
  if (Math.abs(progress - target) < 0.001 && Math.abs(velocity) < 0.01) {
    progress = target
    velocity = 0
    raf = 0
  } else raf = requestAnimationFrame(frame)
  write()
}

function animate() {
  // Natural sizes, read while every size is still the layout's (expanded) or from the unclipped inner content
  full = measure(inner.value)
  lead = measure(leadInner.value)
  trail = measure(trailInner.value)
  if (!collapsible.value || reduceMotion()) {
    cancelAnimationFrame(raf)
    raf = 0
    progress = expanded.value ? 1 : 0
    velocity = 0
    write()
    return
  }
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
}

watch(expanded, animate)
onMounted(() => {
  full = measure(inner.value)
  lead = measure(leadInner.value)
  trail = measure(trailInner.value)
  write()
})
// A re-render (new items) may change the natural sizes: a collapsed toolbar keeps the new ones
onUpdated(() => {
  if (raf || progress === 1) return
  full = measure(inner.value)
  lead = measure(leadInner.value)
  trail = measure(trailInner.value)
  write()
})

// ── collapseOnScroll: Compose's floatingToolbarVerticalNestedScroll. The content's offset (minus the scroll
// position) is compared with a threshold 40dp behind the last switch, so small back-and-forth scrolls don't flicker.
const SCROLL_THRESHOLD = 40
let scroller: HTMLElement | Window | null = null
let lastTop = 0
let threshold = 0
const scrollTop = () => (!scroller ? 0 : scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop)
const resetThreshold = () => (threshold = -lastTop + (expanded.value ? -SCROLL_THRESHOLD : SCROLL_THRESHOLD))

function onScroll() {
  const top = scrollTop()
  const delta = lastTop - top
  lastTop = top
  const offset = -top
  if (delta < 0 && offset <= threshold) {
    threshold = offset + SCROLL_THRESHOLD
    expanded.value = false
  } else if (delta > 0 && offset >= threshold) {
    threshold = offset - SCROLL_THRESHOLD
    expanded.value = true
  }
}

function attachScroll() {
  scroller?.removeEventListener('scroll', onScroll)
  scroller = null
  const target = props.collapseOnScroll
  if (!target || typeof window === 'undefined') return
  scroller = target === true ? window : typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!scroller) return
  scroller.addEventListener('scroll', onScroll, { passive: true })
  lastTop = scrollTop()
  resetThreshold()
}

onMounted(() => {
  attachScroll()
  watch(() => props.collapseOnScroll, attachScroll)
  // Expanded or collapsed some other way (the FAB): scrolling switches it again from here
  watch(expanded, resetThreshold)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  scroller?.removeEventListener('scroll', onScroll)
})

// Starting sizes for the server render and the first paint, set once (the loop writes them from then on)
const startCollapsed = !expanded.value
const fabStart = { width: `${startCollapsed ? FAB_MAX : FAB_MIN}px`, height: `${startCollapsed ? FAB_MAX : FAB_MIN}px` }
const clipStart = startCollapsed ? { [props.orientation === 'vertical' ? 'height' : 'width']: '0px' } : {}
</script>

<template>
  <div
    class="flex items-center gap-2"
    :class="[
      isVertical ? 'flex-col' : 'flex-row',
      fabMode ? (isVertical ? 'min-w-20' : 'min-h-20') : '',
    ]"
  >
    <!-- FAB start -->
    <div v-if="hasFab && fabPosition === 'start'" class="relative size-14 shrink-0">
      <div ref="fabBox" class="absolute" :class="isVertical ? 'top-0 left-1/2 -translate-x-1/2' : 'left-0 top-1/2 -translate-y-1/2'" :style="fabStart">
        <MToolbarFab :color="fabColor"><slot name="fab" /></MToolbarFab>
      </div>
    </div>

    <!-- Floating with a FAB: the pill clips toward the FAB inside a region that keeps the toolbar's footprint -->
    <div
      v-if="fabMode"
      ref="region"
      class="flex shrink-0"
      :class="[isVertical ? 'flex-col' : 'flex-row', fabPosition === 'end' ? 'justify-end' : 'justify-start']"
    >
      <div
        ref="body"
        class="overflow-hidden rounded-full shadow-elevation-1"
        :class="[isVertical ? 'w-16' : 'h-16', colorClasses]"
        :style="clipStart"
        :inert="hidden || undefined"
      >
        <div
          ref="inner"
          class="flex shrink-0 items-center gap-1"
          :class="[isVertical ? 'h-max w-16 flex-col py-2' : 'h-16 w-max flex-row px-2', alignClass]"
        >
          <slot name="leading" />
          <slot />
          <slot name="trailing" />
        </div>
      </div>
    </div>

    <!-- Toolbar body -->
    <div
      v-else
      class="flex items-center"
      :class="[
        sections ? '' : 'gap-1',
        isVertical ? 'flex-col w-16' : 'flex-row h-16',
        isVertical ? (floating ? 'py-2' : 'py-4') : (floating ? 'px-2' : 'px-4'),
        alignClass,
        colorClasses,
        floating ? 'rounded-full' : '',
        floating && hasFab ? 'shadow-elevation-1' : '',
        variant === 'docked' ? 'w-full border-t border-outline-variant' : '',
        variant === 'docked' && isVertical ? 'h-full w-16 border-t-0 border-r border-outline-variant' : '',
      ]"
    >
      <template v-if="sections">
        <!-- Each side closes toward the center: its content is anchored to the center-facing edge -->
        <div
          v-if="$slots.leading"
          ref="leadClip"
          class="flex shrink-0 overflow-hidden"
          :class="isVertical ? 'flex-col justify-end' : 'flex-row justify-end'"
          :style="floating ? clipStart : undefined"
          :inert="hidden || undefined"
        >
          <div ref="leadInner" class="flex shrink-0 items-center gap-1" :class="isVertical ? 'flex-col pb-1' : 'flex-row pe-1'">
            <slot name="leading" />
          </div>
        </div>
        <div class="flex items-center gap-1" :class="isVertical ? 'flex-col' : 'flex-row'">
          <slot />
        </div>
        <div
          v-if="$slots.trailing"
          ref="trailClip"
          class="flex shrink-0 overflow-hidden"
          :class="isVertical ? 'flex-col justify-start' : 'flex-row justify-start'"
          :style="floating ? clipStart : undefined"
          :inert="hidden || undefined"
        >
          <div ref="trailInner" class="flex shrink-0 items-center gap-1" :class="isVertical ? 'flex-col pt-1' : 'flex-row ps-1'">
            <slot name="trailing" />
          </div>
        </div>
      </template>
      <slot v-else />
    </div>

    <!-- FAB end -->
    <div v-if="hasFab && fabPosition === 'end'" class="relative size-14 shrink-0">
      <div ref="fabBox" class="absolute" :class="isVertical ? 'bottom-0 left-1/2 -translate-x-1/2' : 'right-0 top-1/2 -translate-y-1/2'" :style="fabStart">
        <MToolbarFab :color="fabColor"><slot name="fab" /></MToolbarFab>
      </div>
    </div>
  </div>
</template>
