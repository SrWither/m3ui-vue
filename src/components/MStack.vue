<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    direction?: 'column' | 'row'
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
    justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
    wrap?: boolean
    divider?: boolean
    inline?: boolean
  }>(),
  { direction: 'column', gap: 'md', align: 'stretch', justify: 'start', wrap: false, divider: false, inline: false },
)

const gapClasses: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
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

const classes = computed(() => [
  props.inline ? 'inline-flex' : 'flex',
  props.direction === 'row' ? 'flex-row' : 'flex-col',
  !props.divider && gapClasses[props.gap],
  alignClasses[props.align],
  justifyClasses[props.justify],
  props.wrap && 'flex-wrap',
])

const dividerClass = computed(() =>
  props.direction === 'row' ? 'w-px self-stretch bg-outline-variant' : 'h-px w-full bg-outline-variant',
)
</script>

<template>
  <div :class="classes">
    <template v-if="divider">
      <template v-for="(_, i) in ($slots.default?.() ?? [])" :key="i">
        <div v-if="i > 0" :class="dividerClass" role="separator" />
        <component :is="_" />
      </template>
    </template>
    <slot v-else />
  </div>
</template>
