<script setup lang="ts">
/**
 * Fills the entire viewport (or parent when `fixed=false`). Useful for loading screens, splash pages, or modal
 * backdrops.
 *
 * @slot default The content that goes full screen.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Use position: fixed to fill the viewport instead of the parent element */
    fixed?: boolean
    /** Z-index value */
    zIndex?: number
  }>(),
  { fixed: true, zIndex: 50 },
)

const style = computed(() => ({
  position: (props.fixed ? 'fixed' : 'absolute') as 'fixed' | 'absolute',
  inset: '0',
  zIndex: props.zIndex,
}))
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
