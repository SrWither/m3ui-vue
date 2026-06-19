<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  fullHeight?: boolean
}>(), { fullHeight: false })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const close = () => emit('update:modelValue', false)

// Drag-to-dismiss state
const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function onHandlePointerDown(e: PointerEvent) {
  dragging.value = true
  startY = e.clientY
  dragY.value = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onHandlePointerMove(e: PointerEvent) {
  if (!dragging.value) return
  dragY.value = Math.max(0, e.clientY - startY)
}
function onHandlePointerUp() {
  if (dragY.value > 100) close()
  dragging.value = false
  dragY.value = 0
}

const sheetStyle = computed(() => ({
  transform: `translateY(${dragY.value}px)`,
  transition: dragging.value ? 'none' : undefined,
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="bs" :duration="{ enter: 320, leave: 280 }">
      <div v-if="modelValue" class="fixed inset-0 z-200 flex flex-col justify-end">
        <!-- Scrim -->
        <div class="bs-scrim absolute inset-0 bg-black/40" @click="close" />

        <!-- Panel -->
        <div
          class="bs-panel relative flex w-full flex-col rounded-t-xl bg-surface-container-low shadow-elevation-3"
          :class="fullHeight ? 'max-h-[92vh]' : 'max-h-[60vh]'"
          :style="sheetStyle"
        >
          <!-- Drag handle -->
          <div
            class="flex h-9 shrink-0 cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
            @pointerdown="onHandlePointerDown"
            @pointermove="onHandlePointerMove"
            @pointerup="onHandlePointerUp"
          >
            <div class="h-1 w-8 rounded-full bg-on-surface-variant/40" />
          </div>

          <!-- Header -->
          <div v-if="title" class="flex shrink-0 items-center justify-between px-6 pb-4">
            <h2 class="text-title-large text-on-surface">{{ title }}</h2>
            <button
              type="button"
              class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
              @click="close"
            >
              <MIcon name="close" :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-6 pb-6">
            <slot />
          </div>

          <!-- Actions -->
          <div v-if="$slots.actions" class="shrink-0 border-t border-outline-variant px-6 py-4">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bs-scrim {
  transition: opacity 300ms ease;
}
.bs-enter-from .bs-scrim,
.bs-leave-to .bs-scrim {
  opacity: 0;
}

.bs-panel {
  transition:
    transform 320ms cubic-bezier(0.2, 0, 0, 1),
    opacity 240ms ease;
}
.bs-enter-from .bs-panel {
  transform: translateY(40%);
  opacity: 0;
}
.bs-leave-to .bs-panel {
  transform: translateY(100%) !important;
  opacity: 0;
}
</style>
