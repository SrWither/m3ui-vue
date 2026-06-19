<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    surface?: 'default' | 'container' | 'container-low' | 'container-high' | 'container-highest' | 'primary-container' | 'secondary-container' | 'tertiary-container' | 'inverse'
    padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
    elevation?: 0 | 1 | 2 | 3
    border?: boolean
    tag?: string
  }>(),
  { padding: 'none', rounded: 'none', elevation: 0, border: false, tag: 'div' },
)

const surfaceClasses: Record<string, string> = {
  default: 'bg-surface text-on-surface',
  container: 'bg-surface-container text-on-surface',
  'container-low': 'bg-surface-container-low text-on-surface',
  'container-high': 'bg-surface-container-high text-on-surface',
  'container-highest': 'bg-surface-container-highest text-on-surface',
  'primary-container': 'bg-primary-container text-on-primary-container',
  'secondary-container': 'bg-secondary-container text-on-secondary-container',
  'tertiary-container': 'bg-tertiary-container text-on-tertiary-container',
  inverse: 'bg-inverse-surface text-inverse-on-surface',
}

const paddingClasses: Record<string, string> = {
  none: '',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
}

const roundedClasses: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

const elevationClasses: Record<number, string> = {
  0: '',
  1: 'shadow-elevation-1',
  2: 'shadow-elevation-2',
  3: 'shadow-elevation-3',
}

const classes = computed(() => [
  props.surface && surfaceClasses[props.surface],
  paddingClasses[props.padding],
  roundedClasses[props.rounded],
  elevationClasses[props.elevation],
  props.border && 'border border-outline-variant',
])
</script>

<template>
  <component :is="tag" :class="classes">
    <slot />
  </component>
</template>
