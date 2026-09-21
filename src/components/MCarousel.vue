<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import MIcon from './MIcon.vue'

export interface CarouselItem {
  src: string
  alt?: string
  label?: string
}

/*
 * Ported from the real M3 `HorizontalMultiBrowseCarousel` (Carousel.kt/Keylines.kt), not the
 * "flat fixed-width items" look this library's old MCarousel had (now MSimpleCarousel). The real
 * spec's signature behavior: one large "focal" item at rest, with neighbors progressively masked
 * down toward a small "peek" size the further they are from the focal position — items grow/shrink
 * continuously as you scroll, they're not just fixed-size slides.
 *
 * Real defaults ported exactly: minSmallItemWidth = MinSmallItemSize = 40dp, maxSmallItemWidth =
 * MaxSmallItemSize = 56dp, itemSpacing = 0dp, targetSmallSize = clamp(largeSize/3, min, max), and
 * the left-aligned focal convention (createLeftAlignedKeylineList — the focal item sits at the
 * scroll container's left edge, not centered).
 *
 * Deliberately NOT ported: the real `Arrangement.findLowestCostArrangement` combinatorial search
 * that decides exactly how many large/medium/small items fit a given width to the pixel. That's a
 * large amount of code for a difference only visible at unusual width/item-count combinations —
 * this uses a direct triangular falloff from the focal position instead, which converges to the
 * same large-focal-item-with-shrinking-neighbors look for realistic carousels.
 */
const props = withDefaults(
  defineProps<{
    items: CarouselItem[]
    /** Target width of the large, fully-visible focal item, in px (preferredItemWidth). */
    itemWidth?: number
    /** Spacing between item slots, in px. Real default (CarouselDefaults.ItemSpacing) is 0. */
    itemSpacing?: number
    /** Real default (CarouselDefaults.MinSmallItemSize) is 40. */
    minSmallItemWidth?: number
    /** Real default (CarouselDefaults.MaxSmallItemSize) is 56. */
    maxSmallItemWidth?: number
    height?: string
    showArrows?: boolean
    autoplay?: boolean
    interval?: number
  }>(),
  {
    itemWidth: 280,
    itemSpacing: 0,
    minSmallItemWidth: 40,
    maxSmallItemWidth: 56,
    height: '220px',
    showArrows: true,
    autoplay: false,
    interval: 5000,
  },
)

const emit = defineEmits<{ change: [index: number] }>()

const trackEl = ref<HTMLElement | null>(null)
const itemEls = ref<(HTMLElement | null)[]>([])
const containerWidth = ref(0)
const activeIndex = ref(0)

function setItemRef(el: unknown, i: number) {
  itemEls.value[i] = (el as HTMLElement) ?? null
}

const targetLarge = computed(() => Math.min(props.itemWidth, containerWidth.value || props.itemWidth))
const targetSmall = computed(() => {
  const raw = targetLarge.value / 3
  return Math.min(Math.max(raw, props.minSmallItemWidth), props.maxSmallItemWidth)
})

const maskWidths = ref<number[]>([])
const imgOffsets = ref<number[]>([])
let rafId = 0

function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    updateMasks()
  })
}

function updateMasks() {
  if (!trackEl.value) return
  const trackLeft = trackEl.value.getBoundingClientRect().left
  const large = targetLarge.value
  const small = targetSmall.value
  const widths: number[] = []
  const offsets: number[] = []
  let closest = 0
  let closestDist = Infinity

  for (let i = 0; i < itemEls.value.length; i++) {
    const el = itemEls.value[i]
    if (!el) { widths.push(large); offsets.push(0); continue }
    const offset = el.getBoundingClientRect().left - trackLeft

    let width: number
    let imgOffset: number
    if (offset <= 0) {
      // Exiting (or resting) on the left: mask grows in from the left, keep the right portion
      // of the image visible (matches the real maskStart clipping from the item's start edge).
      width = Math.max(large + offset, small)
      imgOffset = -(large - width)
    } else {
      // Upcoming on the right: mask shrinks from the right, keep the left portion visible.
      width = Math.max(large - offset, small)
      imgOffset = 0
    }
    widths.push(width)
    offsets.push(imgOffset)

    const dist = Math.abs(offset)
    if (dist < closestDist) { closestDist = dist; closest = i }
  }

  maskWidths.value = widths
  imgOffsets.value = offsets

  if (closest !== activeIndex.value) {
    activeIndex.value = closest
    emit('change', closest)
  }
}

// The item element's own width IS the animated mask width — not a fixed-width outer "slot"
// with a shrinking element inside it. That was the first cut of this component, and it was
// wrong: shrinking an inner element while its outer flex-item stayed at the full large width
// just left dead space where the flex item used to be, instead of letting flex naturally close
// the gap by reflowing the next item up against it (exactly what the real component's keyline
// masking achieves, just via a different mechanism — Compose positions items directly from
// keyline offsets rather than relying on flow layout, but the visual result needs to be the same:
// no gaps between items regardless of their current mask size).
function itemStyle(i: number) {
  return {
    width: `${maskWidths.value[i] ?? targetLarge.value}px`,
    height: '100%',
    flexShrink: '0',
    overflow: 'hidden',
    position: 'relative' as const,
  }
}

function imgStyle(i: number) {
  return {
    width: `${targetLarge.value}px`,
    height: '100%',
    position: 'absolute' as const,
    left: `${imgOffsets.value[i] ?? 0}px`,
    top: '0',
  }
}

function scrollToItem(index: number) {
  const el = itemEls.value[index]
  if (!el || !trackEl.value) return
  trackEl.value.scrollTo({ left: el.offsetLeft, behavior: 'smooth' })
}

function next() {
  const i = activeIndex.value < props.items.length - 1 ? activeIndex.value + 1 : 0
  scrollToItem(i)
}
function prev() {
  const i = activeIndex.value > 0 ? activeIndex.value - 1 : props.items.length - 1
  scrollToItem(i)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

let autoTimer: ReturnType<typeof setInterval> | null = null
function startAutoplay() {
  stopAutoplay()
  if (props.autoplay && props.items.length > 1) autoTimer = setInterval(next, props.interval)
}
function stopAutoplay() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (trackEl.value) {
    containerWidth.value = trackEl.value.clientWidth
    resizeObserver = new ResizeObserver(() => {
      if (trackEl.value) containerWidth.value = trackEl.value.clientWidth
      updateMasks()
    })
    resizeObserver.observe(trackEl.value)
  }
  nextTick(updateMasks)
  startAutoplay()
})
onBeforeUnmount(() => {
  stopAutoplay()
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
})

defineExpose({ next, prev, scrollToItem })
</script>

<template>
  <div
    class="group relative overflow-hidden"
    tabindex="0"
    @keydown="onKeydown"
    @mouseenter="stopAutoplay"
    @mouseleave="startAutoplay"
  >
    <div
      ref="trackEl"
      class="carousel-track flex overflow-x-auto"
      :style="{ height, gap: `${itemSpacing}px` }"
      @scroll.passive="onScroll"
    >
      <div
        v-for="(item, i) in items"
        :key="i"
        :ref="(el) => setItemRef(el, i)"
        class="rounded-2xl"
        :style="itemStyle(i)"
      >
        <img
          :src="item.src"
          :alt="item.alt ?? item.label ?? ''"
          class="pointer-events-none object-cover"
          :style="imgStyle(i)"
        />
        <div
          v-if="item.label"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-3 pt-8"
        >
          <p class="text-title-medium font-medium text-white">{{ item.label }}</p>
        </div>
      </div>
    </div>

    <template v-if="showArrows && items.length > 1">
      <button
        type="button"
        class="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface/80 text-on-surface shadow-elevation-1 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-surface hover:shadow-elevation-2 group-hover:opacity-100"
        @click="prev"
      >
        <MIcon name="chevron_left" :size="24" />
      </button>
      <button
        type="button"
        class="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface/80 text-on-surface shadow-elevation-1 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-surface hover:shadow-elevation-2 group-hover:opacity-100"
        @click="next"
      >
        <MIcon name="chevron_right" :size="24" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.carousel-track {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.carousel-track::-webkit-scrollbar {
  display: none;
}
.carousel-track > * {
  scroll-snap-align: start;
}
</style>
