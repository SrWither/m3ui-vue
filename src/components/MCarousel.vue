<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import MIcon from './MIcon.vue'

export interface CarouselItem {
  src: string
  alt?: string
  label?: string
  supportingText?: string
  ratio?: number
}

const props = withDefaults(
  defineProps<{
    items: CarouselItem[]
    layout?: 'hero' | 'multi-browse' | 'uncontained'
    height?: string
    showArrows?: boolean
    showIndicators?: boolean
    autoplay?: boolean
    interval?: number
    gap?: number
    visibleItems?: number
    animated?: boolean
  }>(),
  {
    layout: 'hero',
    height: '320px',
    showArrows: true,
    showIndicators: true,
    autoplay: false,
    interval: 5000,
    gap: 8,
    visibleItems: 3,
    animated: false,
  },
)

const emit = defineEmits<{ change: [index: number] }>()

const trackEl = ref<HTMLElement>()
const itemEls = ref<HTMLElement[]>([])
const activeIndex = ref(0)
const scrollPos = ref(0)
const isPageBased = computed(() => props.layout === 'multi-browse' || props.layout === 'uncontained')

const totalPages = computed(() => {
  if (!isPageBased.value) return props.items.length
  if (!trackEl.value) return 1
  const track = trackEl.value
  return Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth))
})

const activePage = computed(() => {
  if (!isPageBased.value) return activeIndex.value
  if (!trackEl.value) return 0
  const track = trackEl.value
  if (track.scrollWidth <= track.clientWidth) return 0
  const _ = scrollPos.value
  return Math.round(track.scrollLeft / track.clientWidth)
})
const itemTransforms = ref<string[]>([])
const imageTransforms = ref<string[]>([])
let autoTimer: ReturnType<typeof setInterval> | null = null
let rafId = 0
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

function setItemRef(el: any, i: number) {
  if (el) itemEls.value[i] = el as HTMLElement
}

// ── Scroll handling (only transforms, never layout) ────────────
function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    updateTransforms()
  })

  if (scrollTimeout) clearTimeout(scrollTimeout)
}

function updateTransforms() {
  if (!trackEl.value) return
  const track = trackEl.value
  scrollPos.value = track.scrollLeft
  const trackRect = track.getBoundingClientRect()
  const trackW = trackRect.width
  const centerX = trackRect.left + trackW / 2
  const transforms: string[] = []
  const imgTransforms: string[] = []
  let closest = 0
  let closestDist = Infinity

  const refX = props.layout === 'multi-browse' ? trackRect.left : centerX

  for (let i = 0; i < itemEls.value.length; i++) {
    const el = itemEls.value[i]
    if (!el) { transforms.push(''); imgTransforms.push(''); continue }
    const rect = el.getBoundingClientRect()
    const itemCenterX = rect.left + rect.width / 2
    const dist = props.layout === 'multi-browse'
      ? Math.abs(rect.left - refX)
      : Math.abs(itemCenterX - centerX)
    const norm = Math.min(dist / (trackW * 0.5), 1)

    if (props.layout === 'hero') {
      imgTransforms.push(`translateX(${(itemCenterX - centerX) * -0.08}px) scale(1.1)`)
      transforms.push('')
    } else if (props.layout === 'uncontained' && props.animated) {
      const s = 1 - norm * 0.12
      transforms.push(`scale(${s})`)
      imgTransforms.push('')
    } else {
      transforms.push('')
      imgTransforms.push('')
    }

    if (dist < closestDist) {
      closestDist = dist
      closest = i
    }
  }

  itemTransforms.value = transforms
  imageTransforms.value = imgTransforms

  if (closest !== activeIndex.value) {
    activeIndex.value = closest
    emit('change', closest)
  }
}

// ── Fixed item widths (never change during scroll) ─────────────
function itemWidth(i: number) {
  switch (props.layout) {
    case 'hero':
      return `calc(100% - 48px)`
    case 'multi-browse':
      return `calc(${100 / props.visibleItems}% - ${props.gap * (props.visibleItems - 1) / props.visibleItems}px)`
    case 'uncontained':
      return `${(props.items[i]?.ratio ?? 1) * 260}px`
    default:
      return '80%'
  }
}

function itemStyle(i: number) {
  const style: Record<string, string> = {
    flexShrink: '0',
    width: itemWidth(i),
  }
  const t = itemTransforms.value[i]
  if (t) {
    style.transform = t
    style.transition = 'transform 120ms ease-out'
  }
  return style
}

function imgStyle(i: number) {
  const t = imageTransforms.value[i]
  if (!t) return {}
  return { transform: t }
}

// ── Navigation ─────────────────────────────────────────────────
function scrollToItem(index: number) {
  const el = itemEls.value[index]
  if (!el || !trackEl.value) return
  const track = trackEl.value
  const scrollLeft = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2
  track.scrollTo({ left: scrollLeft, behavior: 'smooth' })
}

function scrollToPage(page: number) {
  if (!trackEl.value) return
  const track = trackEl.value
  track.scrollTo({ left: page * track.clientWidth, behavior: 'smooth' })
}

function next() {
  if (isPageBased.value) {
    if (!trackEl.value) return
    trackEl.value.scrollBy({ left: trackEl.value.clientWidth, behavior: 'smooth' })
  } else {
    const i = activeIndex.value < props.items.length - 1 ? activeIndex.value + 1 : 0
    scrollToItem(i)
  }
}

function prev() {
  if (isPageBased.value) {
    if (!trackEl.value) return
    trackEl.value.scrollBy({ left: -trackEl.value.clientWidth, behavior: 'smooth' })
  } else {
    const i = activeIndex.value > 0 ? activeIndex.value - 1 : props.items.length - 1
    scrollToItem(i)
  }
}

function startAutoplay() {
  stopAutoplay()
  if (props.autoplay && props.items.length > 1) {
    autoTimer = setInterval(next, props.interval)
  }
}

function stopAutoplay() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

const trackPadding = computed(() => {
  if (props.layout === 'hero') return '0 24px'
  if (props.layout === 'uncontained') return '0 24px'
  return '0'
})

watch(() => props.autoplay, startAutoplay)
onMounted(() => {
  startAutoplay()
  nextTick(() => updateTransforms())
})
onBeforeUnmount(() => {
  stopAutoplay()
  if (rafId) cancelAnimationFrame(rafId)
})

defineExpose({ next, prev, scrollToItem, scrollToPage })
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
      :class="layout === 'multi-browse' ? 'snap-start' : 'snap-center'"
      :style="{ height, gap: `${gap}px`, padding: trackPadding }"
      @scroll.passive="onScroll"
    >
      <div
        v-for="(item, i) in items"
        :key="i"
        :ref="(el) => setItemRef(el, i)"
        class="relative overflow-hidden rounded-2xl"
        :style="itemStyle(i)"
      >
        <img
          :src="item.src"
          :alt="item.alt ?? item.label ?? ''"
          class="pointer-events-none h-full w-full object-cover"
          :style="imgStyle(i)"
        />

        <div
          v-if="item.label || item.supportingText"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-5 pb-4 pt-12"
        >
          <p v-if="item.label" class="text-title-medium font-medium text-white">{{ item.label }}</p>
          <p v-if="item.supportingText" class="mt-0.5 text-body-small text-white/80">{{ item.supportingText }}</p>
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

    <div
      v-if="showIndicators && totalPages > 1"
      class="flex justify-center gap-1.5 pt-3"
    >
      <button
        v-for="p in totalPages"
        :key="p"
        type="button"
        class="h-2 cursor-pointer rounded-full transition-all duration-300"
        :class="(p - 1) === activePage ? 'w-5 bg-on-surface' : 'w-2 bg-on-surface/30 hover:bg-on-surface/50'"
        @click="isPageBased ? scrollToPage(p - 1) : scrollToItem(p - 1)"
      />
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
.snap-center > * {
  scroll-snap-align: center;
}
.snap-start > * {
  scroll-snap-align: start;
}
</style>
