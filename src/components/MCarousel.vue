<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MIcon from './MIcon.vue'

export interface CarouselItem {
  src: string
  alt?: string
  title?: string
  subtitle?: string
}

const props = withDefaults(
  defineProps<{
    items: CarouselItem[]
    autoplay?: boolean
    interval?: number
    showArrows?: boolean
    showIndicators?: boolean
    aspectRatio?: string
    rounded?: boolean
  }>(),
  {
    autoplay: false,
    interval: 5000,
    showArrows: true,
    showIndicators: true,
    aspectRatio: '16/9',
    rounded: true,
  },
)

const emit = defineEmits<{ change: [index: number] }>()

const current = ref(0)
const direction = ref<'left' | 'right'>('right')
const transitioning = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let touchStartX = 0

const total = computed(() => props.items.length)
const currentItem = computed(() => props.items[current.value])

function goTo(index: number) {
  if (transitioning.value || index === current.value) return
  direction.value = index > current.value ? 'right' : 'left'
  transitioning.value = true
  current.value = ((index % total.value) + total.value) % total.value
  emit('change', current.value)
}

function next() {
  goTo(current.value + 1)
}

function prev() {
  goTo(current.value - 1)
}

function onTransitionEnd() {
  transitioning.value = false
}

function startAutoplay() {
  stopAutoplay()
  if (props.autoplay && total.value > 1) {
    timer = setInterval(next, props.interval)
  }
}

function stopAutoplay() {
  if (timer) { clearInterval(timer); timer = null }
}

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]!.clientX
  stopAutoplay()
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0]!.clientX - touchStartX
  if (Math.abs(dx) > 50) {
    dx < 0 ? next() : prev()
  }
  startAutoplay()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

watch(() => props.autoplay, startAutoplay)
onMounted(startAutoplay)
onBeforeUnmount(stopAutoplay)

defineExpose({ next, prev, goTo })
</script>

<template>
  <div
    class="group relative overflow-hidden bg-surface-container-highest"
    :class="rounded ? 'rounded-2xl' : ''"
    :style="{ aspectRatio }"
    tabindex="0"
    @keydown="onKeydown"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
    @mouseenter="stopAutoplay"
    @mouseleave="startAutoplay"
  >
    <!-- Slides -->
    <TransitionGroup
      :name="direction === 'right' ? 'm3-carousel-right' : 'm3-carousel-left'"
      tag="div"
      class="relative h-full w-full"
      @after-enter="onTransitionEnd"
      @after-leave="onTransitionEnd"
    >
      <div
        v-for="(item, i) in items"
        v-show="i === current"
        :key="i"
        class="absolute inset-0"
      >
        <img
          :src="item.src"
          :alt="item.alt ?? item.title ?? ''"
          class="h-full w-full object-cover"
        />

        <!-- Overlay with text -->
        <div
          v-if="item.title || item.subtitle"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-6 pb-6 pt-16"
        >
          <h3 v-if="item.title" class="text-title-large font-medium text-white">{{ item.title }}</h3>
          <p v-if="item.subtitle" class="mt-1 text-body-medium text-white/80">{{ item.subtitle }}</p>
        </div>
      </div>
    </TransitionGroup>

    <!-- Arrows -->
    <template v-if="showArrows && total > 1">
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

    <!-- Indicators -->
    <div
      v-if="showIndicators && total > 1"
      class="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 pb-3"
      :class="currentItem?.title || currentItem?.subtitle ? 'pb-20' : 'pb-3'"
    >
      <button
        v-for="(_, i) in items"
        :key="i"
        type="button"
        class="h-2 cursor-pointer rounded-full transition-all duration-300"
        :class="i === current ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'"
        @click="goTo(i)"
      />
    </div>
  </div>
</template>

<style>
.m3-carousel-right-enter-active,
.m3-carousel-right-leave-active,
.m3-carousel-left-enter-active,
.m3-carousel-left-leave-active {
  transition: transform 500ms cubic-bezier(0.2, 0, 0, 1), opacity 500ms cubic-bezier(0.2, 0, 0, 1);
}

.m3-carousel-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.m3-carousel-right-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.m3-carousel-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.m3-carousel-left-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
