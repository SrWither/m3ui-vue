<script setup lang="ts">
import { computed } from 'vue'

export type TextVariant =
  | 'display-large' | 'display-medium' | 'display-small'
  | 'headline-large' | 'headline-medium' | 'headline-small'
  | 'title-large' | 'title-medium' | 'title-small'
  | 'body-large' | 'body-medium' | 'body-small'
  | 'label-large' | 'label-medium' | 'label-small'

const props = withDefaults(
  defineProps<{
    variant?: TextVariant
    tag?: string
    color?: 'on-surface' | 'on-surface-variant' | 'primary' | 'secondary' | 'tertiary' | 'error' | 'inherit'
    align?: 'left' | 'center' | 'right'
    truncate?: boolean
    lines?: 1 | 2 | 3 | 4 | 5 | 6
    weight?: 'regular' | 'medium' | 'bold'
  }>(),
  { variant: 'body-medium', color: 'inherit', align: 'left' },
)

const defaultTags: Record<string, string> = {
  'display-large': 'h1',
  'display-medium': 'h2',
  'display-small': 'h3',
  'headline-large': 'h1',
  'headline-medium': 'h2',
  'headline-small': 'h3',
  'title-large': 'p',
  'title-medium': 'p',
  'title-small': 'p',
  'body-large': 'p',
  'body-medium': 'p',
  'body-small': 'p',
  'label-large': 'span',
  'label-medium': 'span',
  'label-small': 'span',
}

const variantClasses: Record<string, string> = {
  'display-large': 'text-display-large',
  'display-medium': 'text-display-medium',
  'display-small': 'text-display-small',
  'headline-large': 'text-headline-large',
  'headline-medium': 'text-headline-medium',
  'headline-small': 'text-headline-small',
  'title-large': 'text-title-large',
  'title-medium': 'text-title-medium',
  'title-small': 'text-title-small',
  'body-large': 'text-body-large',
  'body-medium': 'text-body-medium',
  'body-small': 'text-body-small',
  'label-large': 'text-label-large',
  'label-medium': 'text-label-medium',
  'label-small': 'text-label-small',
}

const colorClasses: Record<string, string> = {
  'on-surface': 'text-on-surface',
  'on-surface-variant': 'text-on-surface-variant',
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error',
  inherit: '',
}

const weightClasses: Record<string, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  bold: 'font-bold',
}

const alignClasses: Record<string, string> = {
  left: '',
  center: 'text-center',
  right: 'text-right',
}

const lineClasses: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
}

const resolvedTag = computed(() => props.tag || defaultTags[props.variant])

const classes = computed(() => [
  variantClasses[props.variant],
  colorClasses[props.color],
  alignClasses[props.align],
  props.weight && weightClasses[props.weight],
  props.truncate && 'truncate',
  props.lines && lineClasses[props.lines],
])
</script>

<template>
  <component :is="resolvedTag" :class="classes">
    <slot />
  </component>
</template>
