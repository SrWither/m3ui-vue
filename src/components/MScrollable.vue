<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    direction?: 'vertical' | 'horizontal' | 'both'
    height?: string
    maxHeight?: string
  }>(),
  { direction: 'vertical' },
)

const overflowClasses: Record<string, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
}

const classes = computed(() => overflowClasses[props.direction])

const style = computed(() => ({
  height: props.height,
  maxHeight: props.maxHeight,
}))
</script>

<template>
  <div :class="classes" :style="style">
    <slot />
  </div>
</template>
