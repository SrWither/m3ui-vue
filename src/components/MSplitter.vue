<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    direction?: 'horizontal' | 'vertical'
    initialSplit?: number
    min?: number
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
  dragging.value = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
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
      class="z-10 flex shrink-0 items-center justify-center transition-colors"
      :class="[
        isHorizontal
          ? 'w-2 cursor-col-resize flex-col'
          : 'h-2 cursor-row-resize flex-row',
        dragging ? 'bg-primary/20' : 'bg-outline-variant/40 hover:bg-primary/12',
      ]"
      style="touch-action: none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        class="rounded-full bg-outline"
        :class="isHorizontal ? 'h-6 w-1' : 'h-1 w-6'"
      />
    </div>

    <div class="overflow-auto" :style="panelBStyle">
      <slot name="second" />
    </div>
  </div>
</template>
