<script setup lang="ts">
/**
 * Two resizable panels divided by a draggable bar with M3's drag handle (MDragHandle) on it. The bar is also a
 * keyboard separator: arrow keys move it (Shift for 10%), Home/End jump to the limits.
 *
 * @slot first Content for the first (left/top) panel
 * @slot second Content for the second (right/bottom) panel
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import MDragHandle from './MDragHandle.vue'

const props = withDefaults(
  defineProps<{
    /** Split direction */
    direction?: 'horizontal' | 'vertical'
    /** Initial split percentage */
    initialSplit?: number
    /** Minimum panel percentage */
    min?: number
    /** Maximum panel percentage */
    max?: number
  }>(),
  { direction: 'horizontal', initialSplit: 50, min: 10, max: 90 },
)

const split = ref(props.initialSplit)
const dragging = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const isHorizontal = computed(() => props.direction === 'horizontal')

const panelAStyle = computed(() =>
  isHorizontal.value
    ? { width: `${split.value}%` }
    : { height: `${split.value}%` },
)

const panelBStyle = computed(() =>
  isHorizontal.value
    ? { width: `${100 - split.value}%` }
    : { height: `${100 - split.value}%` },
)

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 1
  const back = isHorizontal.value ? 'ArrowLeft' : 'ArrowUp'
  const fwd = isHorizontal.value ? 'ArrowRight' : 'ArrowDown'
  let next: number
  if (e.key === back) next = split.value - step
  else if (e.key === fwd) next = split.value + step
  else if (e.key === 'Home') next = props.min
  else if (e.key === 'End') next = props.max
  else return
  e.preventDefault()
  split.value = Math.min(props.max, Math.max(props.min, next))
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  let pct: number

  if (isHorizontal.value) {
    pct = ((e.clientX - rect.left) / rect.width) * 100
  } else {
    pct = ((e.clientY - rect.top) / rect.height) * 100
  }

  split.value = Math.min(props.max, Math.max(props.min, pct))
}

function onPointerUp() {
  dragging.value = false
}

onBeforeUnmount(() => {
  dragging.value = false
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex overflow-hidden"
    :class="[
      isHorizontal ? 'flex-row' : 'flex-col',
      dragging && 'select-none',
    ]"
    style="height: 100%"
  >
    <div class="overflow-auto" :style="panelAStyle">
      <slot name="first" />
    </div>

    <div
      role="separator"
      tabindex="0"
      :aria-orientation="isHorizontal ? 'vertical' : 'horizontal'"
      :aria-valuenow="Math.round(split)"
      :aria-valuemin="min"
      :aria-valuemax="max"
      class="group z-10 flex shrink-0 items-center justify-center outline-none transition-colors"
      :class="[
        isHorizontal ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize',
        dragging ? 'bg-primary/20' : 'bg-outline-variant/40 hover:bg-primary/12 focus-visible:bg-primary/12',
      ]"
      style="touch-action: none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeydown"
    >
      <MDragHandle
        :orientation="isHorizontal ? 'vertical' : 'horizontal'"
        :dragging="dragging"
        class="rounded-md group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary"
      />
    </div>

    <div class="overflow-auto" :style="panelBStyle">
      <slot name="second" />
    </div>
  </div>
</template>
