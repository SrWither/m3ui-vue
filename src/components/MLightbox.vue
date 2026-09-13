<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

export interface LightboxItem {
  src: string
  alt?: string
  caption?: string
}

interface OriginRect {
  x: number
  y: number
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    /** Explicit gallery. Omit it to auto-detect `<img>` elements rendered in the default slot instead. */
    items?: LightboxItem[]
    index?: number
    loop?: boolean
    closeLabel?: string
    /** Show a row of clickable thumbnails at the bottom for jumping directly to an image. */
    showThumbnails?: boolean
    /** Round the corners of the main opened image (the thumbnail strip keeps its own fixed rounding). */
    rounded?: boolean
  }>(),
  {
    modelValue: false,
    index: 0,
    loop: true,
    showThumbnails: false,
    rounded: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'update:index': [number]
  change: [index: number]
}>()

const locale = useLocale()

const containerEl = ref<HTMLElement>()
const stageImageEl = ref<HTMLElement>()
const scannedItems = ref<LightboxItem[]>([])
const isOpen = ref(props.modelValue)
const currentIndex = ref(props.index)
const direction = ref(1)
// Set on open() when we have a clicked thumbnail to expand from (Discord-style); cleared once
// the opening transition has played so later next()/prev() use the plain slide instead.
const isFirstShow = ref(true)
let originRect: OriginRect | null = null

const galleryItems = computed(() => props.items ?? scannedItems.value)
const current = computed(() => galleryItems.value[currentIndex.value])
const hasMultiple = computed(() => galleryItems.value.length > 1)

watch(() => props.modelValue, (v) => { isOpen.value = v })
watch(() => props.index, (v) => { currentIndex.value = v })

function setIndex(i: number) {
  currentIndex.value = i
  emit('update:index', i)
  emit('change', i)
}

function open(i = 0, sourceEl?: HTMLElement) {
  originRect = sourceEl ? sourceEl.getBoundingClientRect() : null
  isFirstShow.value = true
  setIndex(i)
  isOpen.value = true
  emit('update:modelValue', true)
}

function close() {
  isOpen.value = false
  emit('update:modelValue', false)
}

function next() {
  const len = galleryItems.value.length
  if (!len) return
  isFirstShow.value = false
  direction.value = 1
  if (currentIndex.value < len - 1) setIndex(currentIndex.value + 1)
  else if (props.loop) setIndex(0)
}

function prev() {
  const len = galleryItems.value.length
  if (!len) return
  isFirstShow.value = false
  direction.value = -1
  if (currentIndex.value > 0) setIndex(currentIndex.value - 1)
  else if (props.loop) setIndex(len - 1)
}

function goTo(i: number) {
  if (i === currentIndex.value) return
  isFirstShow.value = false
  direction.value = i > currentIndex.value ? 1 : -1
  setIndex(i)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

// ── Image transition: Discord-style expand from the clicked thumbnail on open, then a
// slide between images on next()/prev()/goTo(). Driven entirely from JS (css: false) since
// the "expand" transform depends on the clicked element's on-screen position/size, which
// plain CSS classes can't know about.
function transitionEndPromise(el: HTMLElement) {
  return new Promise<void>((resolve) => {
    const handler = (ev: TransitionEvent) => {
      if (ev.target !== el) return
      el.removeEventListener('transitionend', handler)
      resolve()
    }
    el.addEventListener('transitionend', handler)
  })
}

function onImageBeforeEnter(el: Element) {
  const target = el as HTMLElement
  if (isFirstShow.value) {
    if (originRect) {
      // Translate by the two boxes' centers (target fills the stage and centers the image via
      // flex, so its center already coincides with the image's), but scale by the ratio against
      // the actual rendered <img> size, not the full-stage wrapper's size.
      const containerRect = target.getBoundingClientRect()
      const imgRect = target.querySelector('img')?.getBoundingClientRect() ?? containerRect
      const dx = originRect.x + originRect.width / 2 - (containerRect.left + containerRect.width / 2)
      const dy = originRect.y + originRect.height / 2 - (containerRect.top + containerRect.height / 2)
      const area = Math.max(imgRect.width * imgRect.height, 1)
      const scale = Math.min(1, Math.max(0.05, Math.sqrt((originRect.width * originRect.height) / area)))
      target.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
    } else {
      target.style.transform = 'scale(0.92)'
    }
  } else {
    target.style.transform = `translateX(${direction.value >= 0 ? 100 : -100}%)`
  }
  target.style.opacity = '0'
}

async function onImageEnter(el: Element, done: () => void) {
  const target = el as HTMLElement
  void target.offsetWidth // force reflow so the "from" styles above are committed first
  if (isFirstShow.value) {
    // Let the scrim fade in on its own first, Discord-style, before the image starts growing.
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  target.style.transition = 'transform 0.32s cubic-bezier(0.2, 0, 0, 1), opacity 0.28s ease'
  target.style.transform = ''
  target.style.opacity = ''
  await transitionEndPromise(target)
  target.style.transition = ''
  isFirstShow.value = false
  done()
}

async function onImageLeave(el: Element, done: () => void) {
  const target = el as HTMLElement
  target.style.transition = 'transform 0.32s cubic-bezier(0.2, 0, 0, 1), opacity 0.28s ease'
  target.style.transform = `translateX(${direction.value >= 0 ? -100 : 100}%)`
  target.style.opacity = '0'
  await transitionEndPromise(target)
  done()
}

// ── Swipe/drag to navigate: follows the pointer 1:1 while held, then either commits to
// next()/prev() (which take over via the enter/leave hooks above, continuing smoothly from
// wherever the drag left off) or springs back to center if released short of the threshold.
let dragPointerId: number | null = null
let dragStartX = 0
let dragOffsetPx = 0
let dragStageWidth = 0
let isDragging = false

function onStagePointerDown(e: PointerEvent) {
  if (!hasMultiple.value || e.button !== 0) return
  const stage = e.currentTarget as HTMLElement
  dragStageWidth = stage.clientWidth
  dragStartX = e.clientX
  dragOffsetPx = 0
  dragPointerId = e.pointerId
  isDragging = true
  stage.setPointerCapture(e.pointerId)
  if (stageImageEl.value) stageImageEl.value.style.transition = 'none'
}

function onStagePointerMove(e: PointerEvent) {
  if (!isDragging || e.pointerId !== dragPointerId) return
  dragOffsetPx = e.clientX - dragStartX
  if (stageImageEl.value) stageImageEl.value.style.transform = `translateX(${dragOffsetPx}px)`
}

function endDrag(e: PointerEvent) {
  if (!isDragging || e.pointerId !== dragPointerId) return
  isDragging = false
  const stage = e.currentTarget as HTMLElement
  if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId)

  const threshold = Math.min(120, dragStageWidth * 0.25)
  const offset = dragOffsetPx
  dragOffsetPx = 0

  if (offset <= -threshold) next()
  else if (offset >= threshold) prev()
  else if (stageImageEl.value) {
    const el = stageImageEl.value
    el.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)'
    el.style.transform = ''
    const cleanup = (ev: TransitionEvent) => {
      if (ev.target !== el) return
      el.style.transition = ''
      el.removeEventListener('transitionend', cleanup)
    }
    el.addEventListener('transitionend', cleanup)
  }
}

// Auto-scan mode: pull <img> elements out of whatever is rendered in the default slot
// (e.g. MMarkdown output, a hand-rolled gallery grid) so this works without building an
// `items` array by hand. Opt an image out with `data-lightbox="false"`.
let observer: MutationObserver | null = null

function scan() {
  if (props.items || !containerEl.value) return
  const imgs = Array.from(containerEl.value.querySelectorAll('img')).filter(
    (img) => img.dataset.lightbox !== 'false',
  )
  scannedItems.value = imgs.map((img) => ({
    src: img.currentSrc || img.src,
    alt: img.alt || undefined,
    caption: img.dataset.caption || img.title || undefined,
  }))
  imgs.forEach((img, i) => {
    img.style.cursor = 'zoom-in'
    img.onclick = (e) => {
      e.preventDefault()
      open(i, img)
    }
  })
}

onMounted(() => {
  if (props.items || !containerEl.value) return
  scan()
  observer = new MutationObserver(scan)
  observer.observe(containerEl.value, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

defineExpose({ open, close, next, prev })
</script>

<template>
  <div ref="containerEl" class="contents">
    <slot />
  </div>

  <Teleport to="body">
    <Transition name="m3-lightbox">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex flex-col bg-black/90"
        @click.self="close"
      >
        <span
          v-if="hasMultiple"
          class="absolute left-2 top-2 z-10 rounded-full bg-black/30 px-3 py-1 text-label-large text-white sm:left-4 sm:top-4"
        >
          {{ currentIndex + 1 }} / {{ galleryItems.length }}
        </span>

        <button
          type="button"
          class="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50 sm:right-4 sm:top-4"
          :aria-label="closeLabel ?? locale.close"
          @click="close"
        >
          <MIcon name="close" :size="24" />
        </button>

        <div class="relative flex flex-1 items-center justify-center overflow-hidden" @click.self="close">
          <button
            v-if="hasMultiple"
            type="button"
            class="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50 sm:left-4"
            :aria-label="locale.previous"
            @click.stop="prev"
          >
            <MIcon name="chevron_left" :size="28" />
          </button>

          <div
            class="relative h-full w-full touch-pan-y overflow-hidden"
            @pointerdown="onStagePointerDown"
            @pointermove="onStagePointerMove"
            @pointerup="endDrag"
            @pointercancel="endDrag"
          >
            <Transition
              :css="false"
              @before-enter="onImageBeforeEnter"
              @enter="onImageEnter"
              @leave="onImageLeave"
            >
              <div
                v-if="current"
                :key="currentIndex"
                ref="stageImageEl"
                class="absolute inset-0 flex items-center justify-center p-4"
                @click="close"
              >
                <img
                  :src="current.src"
                  :alt="current.alt ?? ''"
                  class="max-h-full max-w-full select-none object-contain"
                  :class="rounded ? 'rounded-2xl' : ''"
                  draggable="false"
                  @click.stop
                />
              </div>
            </Transition>
          </div>

          <button
            v-if="hasMultiple"
            type="button"
            class="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50 sm:right-4"
            :aria-label="locale.next"
            @click.stop="next"
          >
            <MIcon name="chevron_right" :size="28" />
          </button>
        </div>

        <p
          v-if="current?.caption"
          class="z-10 px-4 text-center text-body-medium text-white/90"
        >
          {{ current.caption }}
        </p>

        <div
          v-if="showThumbnails && hasMultiple"
          class="z-10 flex justify-center gap-2 overflow-x-auto p-4"
        >
          <button
            v-for="(item, i) in galleryItems"
            :key="i"
            type="button"
            class="h-14 w-14 shrink-0 overflow-hidden rounded-md ring-2 transition-opacity"
            :class="i === currentIndex ? 'opacity-100 ring-white' : 'opacity-50 ring-transparent hover:opacity-80'"
            @click="goTo(i)"
          >
            <img :src="item.src" :alt="item.alt ?? ''" class="h-full w-full object-cover" draggable="false" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-lightbox-enter-active,
.m3-lightbox-leave-active {
  transition: opacity 0.2s ease;
}
.m3-lightbox-enter-from,
.m3-lightbox-leave-to {
  opacity: 0;
}
</style>
