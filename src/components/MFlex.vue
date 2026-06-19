<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
    justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    wrap?: boolean
    inline?: boolean
  }>(),
  { direction: 'row', align: 'stretch', justify: 'start', gap: 'none', wrap: false, inline: false },
)

const directionClasses: Record<string, string> = {
  row: 'flex-row',
  column: 'flex-col',
  'row-reverse': 'flex-row-reverse',
  'column-reverse': 'flex-col-reverse',
}

const alignClasses: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const justifyClasses: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

const gapClasses: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
}

const classes = computed(() => [
  props.inline ? 'inline-flex' : 'flex',
  directionClasses[props.direction],
  alignClasses[props.align],
  justifyClasses[props.justify],
  gapClasses[props.gap],
  props.wrap && 'flex-wrap',
])
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
