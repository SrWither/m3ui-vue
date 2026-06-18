<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    count?: number
    dot?: boolean
    color?: 'primary' | 'error' | 'secondary' | 'tertiary'
    max?: number
  }>(),
  {
    color: 'error',
    max: 99,
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
</script>

<template>
  <span class="relative inline-flex">
    <slot />
    <span
      v-if="show"
      class="absolute -right-1 -top-1 flex items-center justify-center rounded-full font-medium leading-none"
      :class="[
        colorMap[color],
        !label || dot ? 'h-2.5 w-2.5' : label.length > 2 ? 'h-5 min-w-[1.25rem] px-1 text-[10px]' : 'h-5 w-5 text-[10px]',
      ]"
    >
      <span v-if="!dot">{{ label }}</span>
    </span>
  </span>
</template>
