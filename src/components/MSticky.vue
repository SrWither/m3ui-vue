<script setup lang="ts">
/**
 * Sticks content to the top of its scroll container using `position: sticky`.
 *
 * @slot default The content that sticks.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Sticky offset from top (number = px) */
    top?: string | number
    /** Z-index value */
    zIndex?: number
  }>(),
  { top: 0, zIndex: 40 },
)

function toUnit(v: string | number) {
  return typeof v === 'number' ? `${v}px` : v
}

const style = computed(() => ({
  position: 'sticky' as const,
  top: toUnit(props.top),
  zIndex: props.zIndex,
}))
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
