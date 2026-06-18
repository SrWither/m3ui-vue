<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
    fluid?: boolean
    centered?: boolean
    padding?: boolean
  }>(),
  { maxWidth: 'lg', fluid: false, centered: true, padding: true },
)

const maxWidthClasses: Record<string, string> = {
  xs: 'max-w-screen-xs',
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
}

const classes = computed(() => [
  'w-full',
  props.fluid ? 'max-w-full' : maxWidthClasses[props.maxWidth],
  props.centered && 'mx-auto',
  props.padding && 'px-4 sm:px-6 lg:px-8',
])
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
