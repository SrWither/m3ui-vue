<script lang="ts">
export interface CarouselItem {
  src: string
  alt?: string
  label?: string
}

export type CarouselVariant = 'multi-browse' | 'uncontained' | 'hero' | 'full-screen'
export type CarouselFlingBehavior = 'single-advance' | 'multi-browse' | 'no-snap'
</script>

<script setup lang="ts" generic="T = CarouselItem">
/**
 * The Material 3 carousel, with its four layouts. Items keep one size and are laid out side by side; as you
 * scroll, each one is masked down to the space it has, so items grow as they reach the focal position and
 * shrink as they leave. Drag it (touch or mouse), scroll it with a trackpad or a horizontal wheel, or focus it
 * and use the arrow keys. For fixed-width slides with arrows and autoplay, see MSimpleCarousel.
 *
 * @slot item Content of each item, filling its full (unmasked) box. Replaces the default image and label
 * @event update:modelValue The current item changed
 * @event itemClick An item was clicked (not dragged). A partly visible item also scrolls into focus
 */
/*
 * M3 carousel, ported from Compose Material3 (carousel/Carousel.kt and the keyline engine in
 * ../composables/_carouselStrategy.ts). Like Compose's pager-based Carousel, every item has the
 * same size (the strategy's focal size) and they're laid out end to end; what changes while
 * scrolling is only how each one looks: it's clipped to a mask, centered in the item, the size of
 * the keyline it sits on, and translated so masked items touch. The scroll geometry never changes,
 * which is what the old flex/width-based version got wrong (resizing items mid-scroll fought the
 * browser's scroll and scroll-snap).
 *
 * Variants: 'multi-browse' (HorizontalMultiBrowseCarousel), 'uncontained'
 * (HorizontalUncontainedCarousel), 'hero' (HorizontalCenteredHeroCarousel) and 'full-screen'
 * (MDC-Android's FullScreenCarouselStrategy: one item filling the container, usually vertical).
 *
 * Scrolling is our own (Pointer Events + wheel + keys), driven in a rAF loop that writes
 * transform/clip-path straight to each item, never through a reactive :style binding. Release
 * behavior follows CarouselDefaults: singleAdvanceFlingBehavior (at most one item per fling) for
 * multi-browse/hero/full-screen, noSnapFlingBehavior for uncontained, and the snap animation is
 * spring(stiffness = StiffnessMediumLow = 400, dampingRatio = 1). The fling decay itself is an
 * exponential friction curve, an approximation of Android's spline decay.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'
import {
  Strategy,
  fullScreenKeylineList,
  heroKeylineList,
  maxScrollOffset,
  multiBrowseKeylineList,
  placeItem,
  snapScrollOffset,
  uncontainedKeylineList,
} from '../composables/_carouselStrategy'

const props = withDefaults(
  defineProps<{
    /** Items to render, required. CarouselItem by default; any type with an #item slot */
    items: T[]
    /** Index of the current (snapped) item; use with v-model to follow or drive it. */
    modelValue?: number
    /** Carousel layout */
    variant?: CarouselVariant
    /** Scroll axis */
    orientation?: 'horizontal' | 'vertical'
    /**
     * Size of large items along the scroll axis, in px. Multi-browse and hero treat it as the
     * preferred size (the arrangement that fits best wins); uncontained uses it as is. Hero
     * without it fills the container minus its small items; full-screen ignores it.
     */
    itemSize?: number
    /** Space between items, in px (M3 uses 8). */
    itemSpacing?: number
    /** Padding at both ends of the scroll axis, in px. Items scroll under it. */
    contentPadding?: number
    /** Smallest size a small item can take (multi-browse, hero) */
    minSmallItemSize?: number
    /** Largest size a small item can take (multi-browse, hero) */
    maxSmallItemSize?: number
    /** What a release does. Defaults to 'no-snap' for uncontained, 'single-advance' otherwise. */
    flingBehavior?: CarouselFlingBehavior
    /** Allow dragging, wheel and keyboard scrolling */
    userScrollEnabled?: boolean
    /** Height of the carousel. Defaults to 205px for a horizontal carousel that isn't full-screen. */
    height?: string
    /** Accessible name of the carousel. */
    label?: string
  }>(),
  {
    variant: 'multi-browse',
    orientation: 'horizontal',
    itemSpacing: 8,
    contentPadding: 0,
    minSmallItemSize: 40,
    maxSmallItemSize: 56,
    userScrollEnabled: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [index: number]
  itemClick: [item: T, index: number]
}>()

defineSlots<{
  item?: (scope: { item: T; index: number }) => unknown
}>()

const t = useLocale()

const SPRING_STIFFNESS = 400
const SPRING_DAMPING = 1
const MIN_FLING_VELOCITY = 400
const FLING_FRICTION = 4
const DEFAULT_ITEM_SIZE = 186

const rootEl = ref<HTMLElement | null>(null)
const itemEls: (HTMLElement | null)[] = []
const labelEls: (HTMLElement | null)[] = []
let labelWidths: number[] = []
const mainSize = ref(0)
const currentIndex = ref(clampIndex(props.modelValue ?? 0, props.items.length))

const horizontal = computed(() => props.orientation === 'horizontal')
let rtl = false

// Only the number of items matters to the geometry: depending on the array itself would rebuild
// the strategy (and re-snap) whenever a consumer passes a fresh inline array on re-render.
const itemCount = computed(() => props.items.length)

const strategy = computed(() => {
  const size = mainSize.value
  const count = itemCount.value
  const spacing = props.itemSpacing
  const keylines =
    props.variant === 'uncontained'
      ? uncontainedKeylineList(size, props.itemSize ?? DEFAULT_ITEM_SIZE, spacing)
      : props.variant === 'hero'
        ? heroKeylineList(size, props.itemSize ?? null, spacing, count, true, props.minSmallItemSize, props.maxSmallItemSize)
        : props.variant === 'full-screen'
          ? fullScreenKeylineList(size, spacing)
          : multiBrowseKeylineList(size, props.itemSize ?? DEFAULT_ITEM_SIZE, spacing, count, props.minSmallItemSize, props.maxSmallItemSize)
  return new Strategy(keylines, size, spacing, props.contentPadding, props.contentPadding)
})

const itemMainSize = computed(() => (strategy.value.isValid ? strategy.value.itemMainAxisSize : 0))
const snaps = computed(() => Array.from({ length: itemCount.value }, (_, i) => snapScrollOffset(strategy.value, i, itemCount.value)))
const maxScroll = computed(() => (strategy.value.isValid ? maxScrollOffset(strategy.value, itemCount.value) : 0))

const resolvedFling = computed<CarouselFlingBehavior>(
  () => props.flingBehavior ?? (props.variant === 'uncontained' ? 'no-snap' : 'single-advance'),
)

const resolvedHeight = computed(
  () => props.height ?? (horizontal.value && props.variant !== 'full-screen' ? '205px' : undefined),
)

function itemLabel(i: number) {
  return t.carouselItem.replace('{index}', String(i + 1)).replace('{count}', String(props.items.length))
}

function clampIndex(i: number, count: number) {
  return Math.min(Math.max(i, 0), Math.max(count - 1, 0))
}

function nearestIndex(pos: number) {
  let best = 0
  let bestDist = Infinity
  snaps.value.forEach((s, i) => {
    const d = Math.abs(s - pos)
    if (d < bestDist - 0.5) {
      best = i
      bestDist = d
    }
  })
  return best
}

// ── Per-frame state, outside Vue's reactivity ───────────────────────────────────────────────

let scroll = 0
let velocity = 0
let anim: { kind: 'spring'; target: number } | { kind: 'decay' } | null = null
let animFrame = 0
let lastTime = 0
let renderFrame = 0

const round = (v: number) => Math.round(v * 100) / 100

function clampScroll(v: number) {
  return Math.min(Math.max(v, 0), maxScroll.value)
}

function render() {
  const s = strategy.value
  const count = props.items.length
  if (!s.isValid) return
  const size = s.itemMainAxisSize
  const viewport = mainSize.value
  const max = maxScroll.value
  const isHorizontal = horizontal.value

  const index = nearestIndex(scroll)
  if (index !== currentIndex.value) {
    currentIndex.value = index
    emit('update:modelValue', index)
  }

  for (let i = 0; i < count; i++) {
    const el = itemEls[i]
    if (!el) continue
    const p = placeItem(s, i, scroll, max)
    const visibleStart = p.offset + p.maskStart
    const visibleEnd = visibleStart + p.maskSize
    el.style.visibility = visibleEnd <= 0 || visibleStart >= viewport ? 'hidden' : ''
    const pos = round(isHorizontal && rtl ? viewport - p.offset - size : p.offset)
    el.style.transform = isHorizontal ? `translate3d(${pos}px, 0, 0)` : `translate3d(0, ${pos}px, 0)`
    const start = round(p.maskStart)
    const end = round(size - p.maskStart - p.maskSize)
    el.style.clipPath = isHorizontal
      ? `inset(0 ${end}px 0 ${start}px round var(--radius-xl))`
      : `inset(${start}px 0 ${end}px 0 round var(--radius-xl))`
    // The current item is in front and the others descend with their distance from it.
    el.style.zIndex = String(count - Math.abs(i - index))
    el.style.setProperty('--m3-carousel-mask-start', `${start}px`)
    el.style.setProperty('--m3-carousel-mask-size', `${round(p.maskSize)}px`)

    // Default label: fades in once the mask is wide enough to show it whole (the Compose
    // FadingHorizontalMultiBrowseCarouselSample formula).
    const label = labelEls[i]
    const labelWidth = labelWidths[i] ?? 0
    if (label && labelWidth > 0) {
      label.style.opacity = String(Math.max(labelWidth - s.maxItemSize + p.maskSize, 0) / labelWidth)
    }
  }
}

function scheduleRender() {
  if (renderFrame) return
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0
    render()
  })
}

function stopAnimation() {
  anim = null
  if (animFrame) cancelAnimationFrame(animFrame)
  animFrame = 0
}

function startAnimation(next: NonNullable<typeof anim>) {
  anim = next
  if (animFrame) return
  lastTime = performance.now()
  animFrame = requestAnimationFrame(step)
}

function step(now: number) {
  animFrame = 0
  if (!anim) return
  const dt = Math.min((now - lastTime) / 1000, 1 / 30)
  lastTime = now

  if (anim.kind === 'spring') {
    const target = anim.target
    // Semi-implicit Euler in fixed substeps, like _useSheetMotion.
    const h = 0.004
    for (let left = dt; left > 0; left -= h) {
      const sub = Math.min(h, left)
      const accel = -SPRING_STIFFNESS * (scroll - target) - 2 * SPRING_DAMPING * Math.sqrt(SPRING_STIFFNESS) * velocity
      velocity += accel * sub
      scroll += velocity * sub
    }
    if (Math.abs(scroll - target) < 0.5 && Math.abs(velocity) < 10) {
      scroll = target
      velocity = 0
      anim = null
    }
  } else {
    velocity *= Math.exp(-FLING_FRICTION * dt)
    const next = clampScroll(scroll + velocity * dt)
    if (next !== scroll + velocity * dt) velocity = 0
    scroll = next
    if (Math.abs(velocity) < 20) {
      velocity = 0
      anim = null
    }
  }

  render()
  if (anim) animFrame = requestAnimationFrame(step)
}

function springTo(index: number) {
  const target = snaps.value[clampIndex(index, props.items.length)]
  if (target === undefined) return
  startAnimation({ kind: 'spring', target })
}

/** A release with `v` px/s along the scroll offset (positive = towards later items). */
function fling(v: number, startIndex: number) {
  if (resolvedFling.value === 'no-snap') {
    velocity = v
    if (Math.abs(v) >= MIN_FLING_VELOCITY / 4) startAnimation({ kind: 'decay' })
    return
  }
  velocity = v
  if (resolvedFling.value === 'multi-browse') {
    springTo(nearestIndex(clampScroll(scroll + v / FLING_FRICTION)))
    return
  }
  // single-advance: PagerSnapDistance.atMost(1) from the item the gesture started on.
  let target = nearestIndex(scroll)
  if (Math.abs(v) >= MIN_FLING_VELOCITY) {
    const list = snaps.value
    if (v > 0) {
      const i = list.findIndex((s) => s > scroll + 0.5)
      if (i !== -1) target = i
    } else {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i]! < scroll - 0.5) { target = i; break }
      }
    }
    target = Math.min(Math.max(target, startIndex - 1), startIndex + 1)
  }
  springTo(target)
}

function scrollToItem(index: number, animate = true) {
  const i = clampIndex(index, props.items.length)
  const target = snaps.value[i]
  if (target === undefined) return
  if (animate) {
    springTo(i)
  } else {
    stopAnimation()
    scroll = target
    velocity = 0
    render()
  }
}

function next() {
  scrollToItem(currentIndex.value + 1)
}

function prev() {
  scrollToItem(currentIndex.value - 1)
}

// ── Pointer dragging ────────────────────────────────────────────────────────────────────────

interface Press {
  id: number
  x: number
  y: number
  base: number
  startScroll: number
  startIndex: number
  slop: number
  active: boolean
  samples: { t: number; s: number }[]
  wasAnimating: boolean
}
let press: Press | null = null
let suppressClick = false

function onPointerDown(e: PointerEvent) {
  if (!props.userScrollEnabled || e.button !== 0 || !strategy.value.isValid) return
  if ((e.target as Element).closest('input, textarea, select, [contenteditable]')) return
  const wasAnimating = anim !== null
  stopAnimation()
  press = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    base: 0,
    startScroll: scroll,
    startIndex: currentIndex.value,
    slop: e.pointerType === 'touch' ? 8 : 4,
    active: false,
    samples: [],
    wasAnimating,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function onPointerMove(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  const dx = e.clientX - press.x
  const dy = e.clientY - press.y
  const main = horizontal.value ? dx : dy
  const cross = horizontal.value ? dy : dx
  if (!press.active) {
    if (Math.abs(cross) > press.slop && Math.abs(cross) > Math.abs(main)) {
      endPress()
      return
    }
    if (Math.abs(main) <= press.slop) return
    press.active = true
    press.base = main
    try { rootEl.value?.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    document.body.style.userSelect = 'none'
  }
  const sign = horizontal.value && rtl ? 1 : -1
  scroll = clampScroll(press.startScroll + sign * (main - press.base))
  const now = performance.now()
  press.samples.push({ t: now, s: scroll })
  while (press.samples.length > 2 && now - press.samples[0]!.t > 100) press.samples.shift()
  scheduleRender()
}

function releaseVelocity(p: Press) {
  const first = p.samples[0]
  const last = p.samples[p.samples.length - 1]
  if (!first || !last || last.t - first.t < 1 || performance.now() - last.t > 80) return 0
  return ((last.s - first.s) / (last.t - first.t)) * 1000
}

function onPointerUp(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  const p = press
  endPress()
  if (p.active) {
    suppressClick = true
    setTimeout(() => (suppressClick = false), 0)
    fling(releaseVelocity(p), p.startIndex)
  } else if (p.wasAnimating) {
    // A tap that caught a moving carousel: settle it instead of leaving it mid-way.
    fling(0, currentIndex.value)
  }
}

function onPointerCancel(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  const p = press
  endPress()
  if (p.active || p.wasAnimating) fling(0, p.startIndex)
}

function endPress() {
  press = null
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function onClickCapture(e: MouseEvent) {
  if (!suppressClick) return
  e.stopPropagation()
  e.preventDefault()
}

function onItemClick(item: T, index: number) {
  emit('itemClick', item, index)
  const s = strategy.value
  if (!s.isValid) return
  const p = placeItem(s, index, scroll, maxScroll.value)
  const start = p.offset + p.maskStart
  const fullyVisible = p.maskSize >= s.itemMainAxisSize - 0.5 && start >= -0.5 && start + p.maskSize <= mainSize.value + 0.5
  if (!fullyVisible) scrollToItem(index)
}

// ── Wheel and keyboard ──────────────────────────────────────────────────────────────────────

let wheelTimer: ReturnType<typeof setTimeout> | null = null

function onWheel(e: WheelEvent) {
  if (!props.userScrollEnabled || !strategy.value.isValid) return
  let delta = 0
  if (horizontal.value) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) delta = e.deltaX
    else if (e.shiftKey) delta = e.deltaY
    if (rtl) delta = -delta
  } else {
    delta = e.deltaY
  }
  if (e.deltaMode === 1) delta *= 16
  if (!delta) return
  const next = clampScroll(scroll + delta)
  // At an edge, let the page scroll instead.
  if (next === scroll) return
  e.preventDefault()
  stopAnimation()
  scroll = next
  velocity = 0
  scheduleRender()
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    wheelTimer = null
    if (resolvedFling.value !== 'no-snap') springTo(nearestIndex(scroll))
  }, 120)
}

function onKeydown(e: KeyboardEvent) {
  const forward = horizontal.value ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown'
  const backward = horizontal.value ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp'
  let target: number | null = null
  if (e.key === forward) target = currentIndex.value + 1
  else if (e.key === backward) target = currentIndex.value - 1
  else if (e.key === 'Home') target = 0
  else if (e.key === 'End') target = props.items.length - 1
  if (target === null) return
  e.preventDefault()
  scrollToItem(target)
}

// ── Measuring and lifecycle ─────────────────────────────────────────────────────────────────

function measure() {
  const el = rootEl.value
  if (!el) return
  rtl = getComputedStyle(el).direction === 'rtl'
  mainSize.value = horizontal.value ? el.clientWidth : el.clientHeight
}

function measureLabels() {
  labelWidths = labelEls.map((el) => el?.offsetWidth ?? 0)
}

// Resizes, prop changes and item-count changes rebuild the strategy: keep the current item snapped.
watch(
  strategy,
  () => {
    stopAnimation()
    velocity = 0
    currentIndex.value = clampIndex(currentIndex.value, props.items.length)
    scroll = resolvedFling.value === 'no-snap' ? clampScroll(scroll) : (snaps.value[currentIndex.value] ?? 0)
    measureLabels()
    render()
  },
  { flush: 'post' },
)

watch(
  () => props.modelValue,
  (v) => {
    if (v !== undefined && v !== currentIndex.value) scrollToItem(v)
  },
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = rootEl.value!
  el.addEventListener('wheel', onWheel, { passive: false })
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(el)
  measure()
  nextTick(() => {
    measureLabels()
    scroll = snaps.value[currentIndex.value] ?? 0
    render()
  })
})

onBeforeUnmount(() => {
  stopAnimation()
  endPress()
  if (renderFrame) cancelAnimationFrame(renderFrame)
  if (wheelTimer) clearTimeout(wheelTimer)
  resizeObserver?.disconnect()
  rootEl.value?.removeEventListener('wheel', onWheel)
})

defineExpose({
  scrollToItem,
  next,
  prev,
  /** Moves keyboard focus to the carousel, so the arrow keys scroll it */
  focus: (options?: FocusOptions) => rootEl.value?.focus(options),
})
</script>

<template>
  <div
    ref="rootEl"
    class="m3-carousel relative overflow-hidden outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    :class="horizontal ? 'touch-pan-y' : 'touch-pan-x'"
    :style="{ height: resolvedHeight }"
    role="region"
    :aria-roledescription="t.carousel"
    :aria-label="label"
    tabindex="0"
    @pointerdown="onPointerDown"
    @click.capture="onClickCapture"
    @dragstart.prevent
    @keydown="onKeydown"
  >
    <div
      v-for="(item, i) in items"
      :key="i"
      :ref="(el) => (itemEls[i] = el as HTMLElement | null)"
      class="absolute left-0 top-0 overflow-hidden bg-surface-container-highest"
      :style="horizontal ? { width: `${itemMainSize}px`, height: '100%' } : { width: '100%', height: `${itemMainSize}px` }"
      role="group"
      :aria-label="itemLabel(i)"
      data-carousel-item
      @click="onItemClick(item, i)"
    >
      <slot name="item" :item="item" :index="i">
        <img
          :src="(item as CarouselItem).src"
          :alt="(item as CarouselItem).alt ?? (item as CarouselItem).label ?? ''"
          draggable="false"
          class="pointer-events-none size-full select-none object-cover"
        />
        <template v-if="(item as CarouselItem).label">
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          <span
            :ref="(el) => (labelEls[i] = el as HTMLElement | null)"
            class="pointer-events-none absolute bottom-4 whitespace-nowrap text-title-medium text-white"
            style="inset-inline-start: calc(var(--m3-carousel-mask-start, 0px) + 16px)"
          >{{ (item as CarouselItem).label }}</span>
        </template>
      </slot>
    </div>
  </div>
</template>
