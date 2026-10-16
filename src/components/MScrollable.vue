<script setup lang="ts">
/**
 * A constrained scroll area — vertical, horizontal, or both directions.
 *
 * @slot default The scrolling content.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Scroll direction */
    direction?: 'vertical' | 'horizontal' | 'both'
    /** Fixed height (CSS value) */
    height?: string
    /** Maximum height (CSS value) */
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
