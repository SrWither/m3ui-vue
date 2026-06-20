<script setup lang="ts">
import { computed } from 'vue'

export type BadgePosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
export type BadgeOverlap = 'inside' | 'outside' | 'edge'

const props = withDefaults(
  defineProps<{
    count?: number
    dot?: boolean
    color?: 'primary' | 'error' | 'secondary' | 'tertiary'
    max?: number
    position?: BadgePosition
    overlap?: BadgeOverlap
  }>(),
  {
    color: 'error',
    max: 99,
    position: 'top-right',
    overlap: 'edge',
  },
)

const show = computed(() => props.dot || (props.count !== undefined && props.count > 0))

const label = computed(() => {
  if (props.dot || props.count === undefined) return ''
  return props.count > props.max ? `${props.max}+` : String(props.count)
})

const colorMap: Record<string, string> = {
  primary: 'bg-primary text-on-primary',
  error: 'bg-error text-on-error',
  secondary: 'bg-secondary text-on-secondary',
  tertiary: 'bg-tertiary text-on-tertiary',
}

const positionStyle = computed(() => {
  const offsets: Record<BadgeOverlap, string> = {
    outside: '-25%',
    edge: '0%',
    inside: '25%',
  }
  const o = offsets[props.overlap]

  const map: Record<BadgePosition, Record<string, string>> = {
    'top-right':    { top: o, right: o, translate: '50% -50%' },
    'top-left':     { top: o, left: o, translate: '-50% -50%' },
    'bottom-right': { bottom: o, right: o, translate: '50% 50%' },
    'bottom-left':  { bottom: o, left: o, translate: '-50% 50%' },
  }

  return map[props.position]
})
</script>

<template>
  <span class="relative inline-flex">
    <slot />
    <span
      v-if="show"
      class="absolute flex items-center justify-center rounded-full font-medium leading-none"
      :class="[
        colorMap[color],
        !label || dot ? 'h-2.5 w-2.5' : label.length > 2 ? 'h-5 min-w-[1.25rem] px-1 text-[10px]' : 'h-5 w-5 text-[10px]',
      ]"
      :style="positionStyle"
    >
      <span v-if="!dot">{{ label }}</span>
    </span>
  </span>
</template>
