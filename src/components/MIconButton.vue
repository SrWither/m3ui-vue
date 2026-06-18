<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    icon: string
    label: string
    variant?: 'standard' | 'filled' | 'tonal' | 'outlined'
    disabled?: boolean
    size?: number
  }>(),
  {
    variant: 'standard',
    disabled: false,
    size: 40,
  },
)

const base =
  'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-[0.38]'

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'filled':
      return 'bg-primary text-on-primary hover:shadow-elevation-1'
    case 'tonal':
      return 'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1'
    case 'outlined':
      return 'border border-outline text-on-surface-variant hover:bg-on-surface/8'
    default:
      return 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12'
  }
})
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    :class="[base, variantClasses]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <MIcon :name="icon" :size="Math.round(size * 0.55)" />
  </button>
</template>
