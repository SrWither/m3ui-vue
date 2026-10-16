<script setup lang="ts">
/**
 * Maintains a consistent aspect ratio for media or containers.
 *
 * @slot default Content, sized to fill the box.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Aspect ratio (e.g. "16/9", "4/3", 1) — passed straight through to the CSS aspect-ratio property */
    ratio?: string | number
  }>(),
  { ratio: '16/9' },
)

const style = computed(() => ({
  aspectRatio: String(props.ratio),
}))
</script>

<template>
  <div class="relative overflow-hidden" :style="style">
    <slot />
  </div>
</template>
