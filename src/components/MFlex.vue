<script setup lang="ts">
/**
 * A thin, prop-driven wrapper around CSS flexbox — direction, alignment, justification, gap, and wrap.
 *
 * @slot default The flex items.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Flex direction */
    direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
    /** Cross-axis alignment (align-items) */
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
    /** Main-axis alignment (justify-content) */
    justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
    /** Gap between items */
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Allow items to wrap */
    wrap?: boolean
    /** Use inline-flex instead of flex */
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
