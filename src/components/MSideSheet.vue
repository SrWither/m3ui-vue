<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  width?: string
}>(), { width: 'w-80' })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const close = () => emit('update:modelValue', false)

const dragX = ref(0)
const dragging = ref(false)
let startX = 0

function onEdgePointerDown(e: PointerEvent) {
  dragging.value = true
  startX = e.clientX
  dragX.value = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onEdgePointerMove(e: PointerEvent) {
  if (!dragging.value) return
  dragX.value = Math.max(0, e.clientX - startX)
}
function onEdgePointerUp() {
  if (dragX.value > 100) close()
  dragging.value = false
  dragX.value = 0
}

const panelStyle = computed(() => ({
  transform: `translateX(${dragX.value}px)`,
  transition: dragging.value ? 'none' : undefined,
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="ss" :duration="{ enter: 320, leave: 280 }">
      <div v-if="modelValue" class="fixed inset-0 z-200 flex justify-end">
        <!-- Scrim -->
        <div class="ss-scrim absolute inset-0 bg-black/40" @click="close" />

        <!-- Panel -->
        <aside
          class="ss-panel relative flex h-full flex-col bg-surface-container-low shadow-elevation-3"
          :class="[width, 'max-w-[90vw]']"
          :style="panelStyle"
        >
          <!-- Drag edge -->
          <div
            class="absolute top-0 left-0 h-full w-3 cursor-ew-resize touch-none"
            @pointerdown="onEdgePointerDown"
            @pointermove="onEdgePointerMove"
            @pointerup="onEdgePointerUp"
          />

          <!-- Header -->
          <div v-if="title || $slots.header" class="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-4">
            <slot name="header">
              <h2 class="text-title-large text-on-surface">{{ title }}</h2>
            </slot>
            <button
              type="button"
              class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
              @click="close"
            >
              <MIcon name="close" :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <slot />
          </div>

          <!-- Actions -->
          <div v-if="$slots.actions" class="shrink-0 border-t border-outline-variant px-6 py-4">
            <slot name="actions" />
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ss-scrim {
  transition: opacity 280ms ease;
}
.ss-enter-from .ss-scrim,
.ss-leave-to .ss-scrim {
  opacity: 0;
}

.ss-panel {
  transition:
    transform 320ms cubic-bezier(0.2, 0, 0, 1),
    opacity 240ms ease;
}
.ss-enter-from .ss-panel {
  transform: translateX(40%);
  opacity: 0;
}
.ss-leave-to .ss-panel {
  transform: translateX(100%) !important;
  opacity: 0;
}
</style>
