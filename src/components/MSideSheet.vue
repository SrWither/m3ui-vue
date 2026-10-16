<script setup lang="ts">
/**
 * A panel that slides in from the right edge of the screen. Supports drag-to-dismiss from its left edge, or
 * tapping the scrim.
 *
 * @slot header Replaces the default title text entirely — the close button stays
 * @slot default Sheet body content (scrollable)
 * @slot actions Footer action buttons, shown in a bordered strip below the content
 * @event update:modelValue Emitted when the sheet closes (scrim click, drag-to-dismiss from the left edge, or
 *   the close button) — powers v-model
 */
import MIcon from './MIcon.vue'
import { useSheetMotion } from '../composables/_useSheetMotion'

withDefaults(defineProps<{
  /** Open/closed state (v-model) */
  modelValue: boolean
  /** Sheet header title, ignored if the header slot is used */
  title?: string
  /** Tailwind width class for the panel (capped at max-w-[90vw]) */
  width?: string
}>(), { width: 'w-80' })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const close = () => emit('update:modelValue', false)

// Slide in/out and drag-to-dismiss, as springs (see _useSheetMotion).
const motion = useSheetMotion('x', close)
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" @enter="motion.onEnter" @leave="motion.onLeave" appear>
      <div v-if="modelValue" class="fixed inset-0 z-200 flex justify-end">
        <!-- Scrim -->
        <div data-sheet-scrim class="absolute inset-0 bg-scrim/32" @click="close" />

        <!-- Panel -->
        <aside
          data-sheet-panel
          class="relative flex h-full flex-col bg-surface-container-low shadow-elevation-3"
          :class="[width, 'max-w-[90vw]']"
        >
          <!-- Drag edge -->
          <div
            class="absolute top-0 left-0 h-full w-3 cursor-ew-resize touch-none"
            @pointerdown="motion.onDragStart"
            @pointermove="motion.onDragMove"
            @pointerup="motion.onDragEnd"
            @pointercancel="motion.onDragEnd"
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
