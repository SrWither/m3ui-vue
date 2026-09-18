<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    label?: string
    color?: 'primary' | 'secondary' | 'tertiary' | 'error'
  }>(),
  { disabled: false, color: 'primary' },
)

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

// Same 4 named colors as MRadio/MCheckbox's color prop.
const trackClasses: Record<string, string> = {
  primary: 'border-primary bg-primary',
  secondary: 'border-secondary bg-secondary',
  tertiary: 'border-tertiary bg-tertiary',
  error: 'border-error bg-error',
}
const thumbClasses: Record<string, string> = {
  primary: 'bg-on-primary',
  secondary: 'bg-on-secondary',
  tertiary: 'bg-on-tertiary',
  error: 'bg-on-error',
}
const iconClasses: Record<string, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error',
}

// All thumb transforms live here so each direction can use its own easing curve.
// translateY(-50%) vertically centres the 24px thumb in the 32px track.
// ON  → spring cubic-bezier: overshoots ~2px then settles → satisfying "click"
// OFF → M3 standard decelerate: clean snap back, no undershoot
const thumbStyle = computed(() => ({
  transform: props.modelValue
    ? 'translateY(-50%) translateX(18px) scale(1)'
    : 'translateY(-50%) translateX(0px) scale(0.667)',
  transition: props.modelValue
    ? 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 280ms ease'
    : 'transform 240ms cubic-bezier(0.2, 0, 0, 1),          background-color 240ms ease',
}))
</script>

<template>
  <label
    class="inline-flex items-center gap-3 select-none"
    :class="disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer'"
  >
    <span class="relative -my-2 inline-flex h-12 shrink-0 items-center">
      <span
        class="relative inline-flex h-8 w-[52px] items-center rounded-full border-2 transition-colors duration-200"
        :class="modelValue ? trackClasses[color] : 'border-outline bg-surface-container-highest'"
      >
        <input
          type="checkbox"
          class="sr-only"
          :checked="modelValue"
          :disabled="disabled"
          @change="emit('update:modelValue', !modelValue)"
        />

        <!-- Thumb: position + size animated via inline style (allows per-direction easing) -->
        <span
          class="absolute left-1 top-1/2 flex h-6 w-6 items-center justify-center rounded-full will-change-transform"
          :class="modelValue ? [thumbClasses[color], 'shadow-sm'] : 'bg-outline'"
          :style="thumbStyle"
        >
          <Transition
            enter-active-class="transition-opacity duration-150 delay-[120ms]"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-75"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <MIcon v-if="modelValue" name="check" :size="14" :class="iconClasses[color]" />
          </Transition>
        </span>
      </span>
    </span>
    <span v-if="label" class="text-body-large text-on-surface">{{ label }}</span>
  </label>
</template>
