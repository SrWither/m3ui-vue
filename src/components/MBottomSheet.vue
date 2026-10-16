<script setup lang="ts">
/**
 * A sheet that slides up from the bottom of the screen, capped at a 640px max width and rounded top corners.
 * Supports drag-to-dismiss via the handle bar, or tapping the scrim.
 *
 * @slot default Sheet body content (scrollable)
 * @slot actions Footer action buttons, shown in a bordered strip below the content
 * @event update:modelValue Emitted when the sheet closes (scrim click, drag-to-dismiss, or the close button) —
 *   powers v-model
 */
import MIcon from './MIcon.vue'
import { useSheetMotion } from '../composables/_useSheetMotion'

withDefaults(defineProps<{
  /** Open/closed state (v-model) */
  modelValue: boolean
  /** Sheet header title */
  title?: string
  /** Use max-h-[92vh] instead of the default max-h-[60vh] */
  fullHeight?: boolean
}>(), { fullHeight: false })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const close = () => emit('update:modelValue', false)

// Slide in/out and drag-to-dismiss, as springs (see _useSheetMotion).
const motion = useSheetMotion('y', close)
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" @enter="motion.onEnter" @leave="motion.onLeave" appear>
      <div v-if="modelValue" class="fixed inset-0 z-200 flex flex-col justify-end">
        <!-- Scrim -->
        <div data-sheet-scrim class="absolute inset-0 bg-scrim/32" @click="close" />

        <!-- Panel -->
        <div
          data-sheet-panel
          class="relative mx-auto flex w-full max-w-[640px] flex-col rounded-t-[28px] bg-surface-container-low shadow-elevation-1"
          :class="fullHeight ? 'max-h-[92vh]' : 'max-h-[60vh]'"
        >
          <!-- Drag handle -->
          <div
            class="flex h-12 shrink-0 cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
            @pointerdown="motion.onDragStart"
            @pointermove="motion.onDragMove"
            @pointerup="motion.onDragEnd"
            @pointercancel="motion.onDragEnd"
          >
            <div class="h-1 w-8 rounded-full bg-on-surface-variant" />
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
